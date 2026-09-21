import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { withTenant } from "../src/tenant.ts";
import { applyMigrations } from "../src/migrate.ts";

const here = dirname(fileURLToPath(import.meta.url));

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";
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
