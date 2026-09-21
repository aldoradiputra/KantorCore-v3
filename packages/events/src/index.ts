import type { TransactionSql } from "postgres";

/**
 * Typed event catalog. Each module adds its events here so `emit` is checked at
 * compile time. Names are `<object>.<pastTenseVerb>` (ARCH §15).
 */
export interface EventCatalog {
  "record.created": { recordId: string };
}

export type EventType = keyof EventCatalog;

export interface EmitEvent<T extends EventType = EventType> {
  type: T;
  payload: EventCatalog[T];
  /** Optional company scope for multi-company tenants (D9). */
  companyId?: string;
}

/**
 * Append an event to the transactional outbox (D7). Call inside a `withTenant`
 * transaction, in the same tx as the business write, so the event is durable iff the
 * write commits. `tenant_id` is taken from the active tenant GUC, so RLS `WITH CHECK`
 * guarantees it matches the caller's tenant.
 */
export async function emit<T extends EventType>(
  tx: TransactionSql,
  event: EmitEvent<T>,
): Promise<void> {
  await tx`
    insert into tenant.outbox (tenant_id, company_id, type, payload)
    values (
      nullif(current_setting('app.tenant_id', true), '')::uuid,
      ${event.companyId ?? null},
      ${event.type},
      ${tx.json(event.payload as unknown as Parameters<typeof tx.json>[0])}
    )
  `;
}
