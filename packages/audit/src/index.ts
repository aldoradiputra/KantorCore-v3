import type { TransactionSql } from "postgres";

export interface AuditEntry {
  /** What happened, e.g. "record.publish", "grant.create". */
  action: string;
  /** The kind of thing acted on, e.g. "record", "workflow". */
  resource: string;
  /** Optional id of the specific thing. */
  resourceId?: string;
  /** Who did it (user or non-human identity id). */
  actor?: string;
  data?: Record<string, unknown>;
}

/**
 * Append an entry to the tenant's append-only audit log (ARCH §5). Call inside a
 * `withTenant` transaction; `tenant_id` comes from the active tenant GUC. The app role
 * has INSERT/SELECT only — history cannot be edited or deleted.
 */
export async function writeAudit(
  tx: TransactionSql,
  entry: AuditEntry,
): Promise<void> {
  await tx`
    insert into tenant.audit_log (tenant_id, actor, action, resource, resource_id, data)
    values (
      nullif(current_setting('app.tenant_id', true), '')::uuid,
      ${entry.actor ?? null},
      ${entry.action},
      ${entry.resource},
      ${entry.resourceId ?? null},
      ${tx.json((entry.data ?? {}) as unknown as Parameters<typeof tx.json>[0])}
    )
  `;
}
