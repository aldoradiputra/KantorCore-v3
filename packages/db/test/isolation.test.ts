import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { withTenant } from "../src/tenant.ts";
import { applyMigrations } from "../src/migrate.ts";
import { emit } from "@kantorcore/events";
import { writeAudit } from "@kantorcore/audit";
import { makeAuth, createNonHumanIdentity, grantNhi } from "@kantorcore/auth";
import { can } from "@kantorcore/access";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";
const TENANT_C = "00000000-0000-0000-0000-00000000000c";
const TENANT_D = "00000000-0000-0000-0000-00000000000d";
const COMPANY = "00000000-0000-0000-0000-0000000000c1";

let container: StartedPostgreSqlContainer;
let tenantUrl: string;
let controlUrl: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer("pgvector/pgvector:pg18").start();
  const host = container.getHost();
  const port = container.getPort();
  const db = container.getDatabase();

  // Bootstrap (roles, schemas, extensions, grants) as the container superuser.
  const su = postgres(container.getConnectionUri(), { prepare: false });
  const bootstrap = await readFile(join(here, "..", "sql", "bootstrap.sql"), "utf8");
  await su.unsafe(bootstrap).simple();
  await su.end();

  // Apply migrations as kc_migrator.
  const migrator = postgres(
    `postgres://kc_migrator:kc_migrator_dev@${host}:${port}/${db}`,
    { prepare: false },
  );
  await applyMigrations(migrator);
  await migrator.end();

  tenantUrl = `postgres://kc_tenant:kc_tenant_dev@${host}:${port}/${db}`;
  controlUrl = `postgres://kc_control:kc_control_dev@${host}:${port}/${db}`;
}, 180_000);

afterAll(async () => {
  await container?.stop();
});

describe("cross-tenant isolation", () => {
  it("withTenant scopes reads to the active tenant", async () => {
    const sql = postgres(tenantUrl, { prepare: false });
    try {
      await withTenant(sql, { tenantId: TENANT_A, companyId: COMPANY }, async (tx) => {
        await tx`insert into tenant.record (tenant_id, company_id, body) values (${TENANT_A}, ${COMPANY}, 'a-row')`;
      });
      await withTenant(sql, { tenantId: TENANT_B, companyId: COMPANY }, async (tx) => {
        await tx`insert into tenant.record (tenant_id, company_id, body) values (${TENANT_B}, ${COMPANY}, 'b-row')`;
      });
      const rows = await withTenant(
        sql,
        { tenantId: TENANT_A, companyId: COMPANY },
        (tx) => tx`select body from tenant.record order by body`,
      );
      expect(rows.map((r) => r["body"])).toEqual(["a-row"]);
    } finally {
      await sql.end();
    }
  });

  it("returns nothing when no tenant context is set (RLS default-deny)", async () => {
    const sql = postgres(tenantUrl, { prepare: false });
    try {
      const rows = await sql`select * from tenant.record`;
      expect(rows.length).toBe(0);
    } finally {
      await sql.end();
    }
  });

  it("blocks writing another tenant's rows (WITH CHECK)", async () => {
    const sql = postgres(tenantUrl, { prepare: false });
    try {
      await expect(
        withTenant(sql, { tenantId: TENANT_A, companyId: COMPANY }, (tx) =>
          tx`insert into tenant.record (tenant_id, company_id, body) values (${TENANT_B}, ${COMPANY}, 'evil')`,
        ),
      ).rejects.toThrow();
    } finally {
      await sql.end();
    }
  });

  it("denies kc_control any access to tenant business tables", async () => {
    const sql = postgres(controlUrl, { prepare: false });
    try {
      await expect(sql`select * from tenant.record`).rejects.toThrow();
    } finally {
      await sql.end();
    }
  });
});

describe("transactional outbox", () => {
  it("emits into the tenant outbox, RLS-scoped", async () => {
    const sql = postgres(tenantUrl, { prepare: false });
    try {
      await withTenant(sql, { tenantId: TENANT_C, companyId: COMPANY }, (tx) =>
        emit(tx, { type: "record.created", payload: { recordId: "r1" } }),
      );
      const own = await withTenant(sql, { tenantId: TENANT_C }, (tx) =>
        tx`select type from tenant.outbox`,
      );
      expect(own.map((r) => r["type"])).toEqual(["record.created"]);

      const other = await withTenant(sql, { tenantId: TENANT_B }, (tx) =>
        tx`select 1 from tenant.outbox`,
      );
      expect(other.length).toBe(0);
    } finally {
      await sql.end();
    }
  });

  it("rolls the event back when its transaction fails (atomicity)", async () => {
    const sql = postgres(tenantUrl, { prepare: false });
    try {
      await expect(
        withTenant(sql, { tenantId: TENANT_D, companyId: COMPANY }, async (tx) => {
          await emit(tx, { type: "record.created", payload: { recordId: "r2" } });
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      const rows = await withTenant(sql, { tenantId: TENANT_D }, (tx) =>
        tx`select 1 from tenant.outbox`,
      );
      expect(rows.length).toBe(0);
    } finally {
      await sql.end();
    }
  });
});

describe("append-only audit log", () => {
  it("writes tenant-scoped audit entries", async () => {
    const sql = postgres(tenantUrl, { prepare: false });
    try {
      await withTenant(sql, { tenantId: TENANT_C, companyId: COMPANY }, (tx) =>
        writeAudit(tx, {
          action: "record.create",
          resource: "record",
          resourceId: "r1",
          actor: "u1",
        }),
      );
      const rows = await withTenant(sql, { tenantId: TENANT_C }, (tx) =>
        tx`select action from tenant.audit_log`,
      );
      expect(rows.map((r) => r["action"])).toEqual(["record.create"]);
    } finally {
      await sql.end();
    }
  });

  it("forbids mutating history (UPDATE denied for kc_tenant)", async () => {
    const sql = postgres(tenantUrl, { prepare: false });
    try {
      await expect(
        withTenant(sql, { tenantId: TENANT_C }, (tx) =>
          tx`update tenant.audit_log set action = 'tamper'`,
        ),
      ).rejects.toThrow();
    } finally {
      await sql.end();
    }
  });
});

describe("authentication (Better Auth)", () => {
  it("signs up a global user against the platform schema", async () => {
    const { Pool } = pg;
    const pool = new Pool({
      connectionString: tenantUrl,
      options: "-c search_path=platform",
    });
    try {
      const auth = makeAuth({
        pool,
        secret: "test-secret-0123456789abcdef0123456789abcd",
        baseURL: "http://localhost:3000",
      });
      const email = `andi-${Date.now()}@example.com`;
      const res = await auth.api.signUpEmail({
        body: { email, password: "sup3rsecret!", name: "Andi" },
      });
      expect(res?.user?.email).toBe(email);
    } finally {
      await pool.end();
    }
  });
});

describe("authorization (can)", () => {
  it("grants by membership role; denies outside the tenant", async () => {
    const sql = postgres(tenantUrl, { prepare: false });
    try {
      const org = `org-${Date.now()}`;
      const admin = `user-admin-${Date.now()}`;
      const memberU = `user-member-${Date.now()}`;
      await sql`insert into platform.organization (id, name, slug) values (${org}, 'Tenant', ${org})`;
      await sql`insert into platform."user" (id, name, email) values
        (${admin}, 'Admin', ${`${admin}@ex.com`}),
        (${memberU}, 'Member', ${`${memberU}@ex.com`})`;
      await sql`insert into platform.member (id, "organizationId", "userId", role) values
        (${`m-${admin}`}, ${org}, ${admin}, 'admin'),
        (${`m-${memberU}`}, ${org}, ${memberU}, 'member')`;

      const A = { kind: "user", id: admin } as const;
      const M = { kind: "user", id: memberU } as const;
      expect(await can(sql, A, "org.manage", { tenantId: org })).toBe(true);
      expect(await can(sql, M, "record.create", { tenantId: org })).toBe(true);
      expect(await can(sql, M, "org.manage", { tenantId: org })).toBe(false);
      expect(await can(sql, A, "record.read", { tenantId: "other-tenant" })).toBe(false);
    } finally {
      await sql.end();
    }
  });

  it("keeps a non-human identity inert until granted (ARCH §5)", async () => {
    const sql = postgres(tenantUrl, { prepare: false });
    try {
      const org = `org-nhi-${Date.now()}`;
      await sql`insert into platform.organization (id, name, slug) values (${org}, 'Tenant', ${org})`;

      const nhi = await createNonHumanIdentity(sql, { label: "AR Collector" });
      const P = { kind: "nhi", id: nhi.id } as const;

      expect(await can(sql, P, "record.read", { tenantId: org })).toBe(false);
      await grantNhi(sql, { nhiId: nhi.id, tenantId: org, role: "member" });
      expect(await can(sql, P, "record.read", { tenantId: org })).toBe(true);
      expect(await can(sql, P, "org.manage", { tenantId: org })).toBe(false);
    } finally {
      await sql.end();
    }
  });
});
