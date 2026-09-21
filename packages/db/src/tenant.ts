import type { Sql, TransactionSql } from "postgres";

/**
 * The tenant context carried on every tenant-plane query. `tenantId` scopes RLS;
 * `companyId`/`branchId` scope multi-company queries (D9). Composite everywhere.
 */
export interface TenantContext {
  tenantId: string;
  companyId?: string;
  branchId?: string;
}

/**
 * Run `fn` inside a transaction with the tenant GUCs set via `SET LOCAL`
 * (`set_config(..., is_local => true)`), so RLS on `tenant.*` tables sees the
 * active tenant. Every tenant-plane query must go through here (AGENTS.md Rule 2).
 * The GUCs reset automatically when the transaction ends.
 */
export async function withTenant<T>(
  sql: Sql,
  ctx: TenantContext,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('app.tenant_id', ${ctx.tenantId}, true)`;
    if (ctx.companyId !== undefined) {
      await tx`select set_config('app.company_id', ${ctx.companyId}, true)`;
    }
    if (ctx.branchId !== undefined) {
      await tx`select set_config('app.branch_id', ${ctx.branchId}, true)`;
    }
    return fn(tx);
  }) as Promise<T>;
}
