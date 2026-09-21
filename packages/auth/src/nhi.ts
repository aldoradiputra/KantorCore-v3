import type { Sql, TransactionSql } from "postgres";

export interface NonHumanIdentity {
  id: string;
  label: string;
  kind: string;
}

export interface NhiGrantInput {
  nhiId: string;
  /** = organization.id (the tenant). */
  tenantId: string;
  role: string;
  companyId?: string;
  branchId?: string;
}

/**
 * Create a non-human identity (agent / service account). It exists immediately but
 * carries NO rights until `grantNhi` gives it a role in a tenant (ARCH §5).
 */
export async function createNonHumanIdentity(
  sql: Sql | TransactionSql,
  input: { label: string; kind?: string },
): Promise<NonHumanIdentity> {
  const rows = await sql<NonHumanIdentity[]>`
    insert into platform.non_human_identity (label, kind)
    values (${input.label}, ${input.kind ?? "service"})
    returning id, label, kind
  `;
  return rows[0]!;
}

/** Grant a non-human identity a role in a tenant (upsert). */
export async function grantNhi(
  sql: Sql | TransactionSql,
  input: NhiGrantInput,
): Promise<void> {
  await sql`
    insert into platform.nhi_grant (nhi_id, tenant_id, role, company_id, branch_id)
    values (
      ${input.nhiId}, ${input.tenantId}, ${input.role},
      ${input.companyId ?? null}, ${input.branchId ?? null}
    )
    on conflict (nhi_id, tenant_id) do update set role = excluded.role
  `;
}
