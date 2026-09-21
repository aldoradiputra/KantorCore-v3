-- Transactional outbox (D7) + append-only audit log (ARCH §15, §5). Both live in the
-- tenant plane, RLS-scoped, and are written inside the same transaction as the business
-- change so an event/audit row can never diverge from the write that caused it.
-- Applied as kc_migrator.

-- Outbox: the durable event log. Rows are inserted within withTenant(); a background
-- publisher (DBOS, gated on P14) marks published_at. Retained 12 months, then archived.
CREATE TABLE IF NOT EXISTS tenant.outbox (
  tenant_id    uuid NOT NULL,
  id           uuid NOT NULL DEFAULT uuidv7(),
  company_id   uuid,
  type         text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (tenant_id, id)
);

-- Partial index for the publisher's "unpublished, oldest first" scan.
CREATE INDEX IF NOT EXISTS outbox_unpublished_idx
  ON tenant.outbox (tenant_id, occurred_at)
  WHERE published_at IS NULL;

ALTER TABLE tenant.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.outbox FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_tenant_isolation ON tenant.outbox;
CREATE POLICY outbox_tenant_isolation ON tenant.outbox
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Audit log: append-only history of who did what.
CREATE TABLE IF NOT EXISTS tenant.audit_log (
  tenant_id   uuid NOT NULL,
  id          uuid NOT NULL DEFAULT uuidv7(),
  actor       text,
  action      text NOT NULL,
  resource    text NOT NULL,
  resource_id text,
  data        jsonb NOT NULL DEFAULT '{}',
  at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

ALTER TABLE tenant.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_tenant_isolation ON tenant.audit_log;
CREATE POLICY audit_tenant_isolation ON tenant.audit_log
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Append-only: the app role may insert and read, never mutate or delete history.
REVOKE UPDATE, DELETE ON tenant.audit_log FROM kc_tenant;
