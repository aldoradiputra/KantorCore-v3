-- Baseline tenant table: the minimal governed spine that proves tenancy + RLS.
-- The real object model (records + record_index) arrives with the metadata engine
-- (O2); this table exists so withTenant() and the isolation suite have something real
-- to enforce against. Applied as kc_migrator.

CREATE TABLE IF NOT EXISTS tenant.record (
  tenant_id  uuid NOT NULL,
  company_id uuid NOT NULL,
  branch_id  uuid,
  id         uuid NOT NULL DEFAULT uuidv7(),   -- Postgres 18 native (D5, Rule 3)
  body       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- Composite index for multi-company scoping (D9, ARCH §4).
CREATE INDEX IF NOT EXISTS record_scope_idx
  ON tenant.record (tenant_id, company_id, branch_id);

-- RLS is the database safety net (D8). FORCE so even the table owner is constrained;
-- the app connects as kc_tenant, which cannot bypass RLS regardless.
ALTER TABLE tenant.record ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.record FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS record_tenant_isolation ON tenant.record;
CREATE POLICY record_tenant_isolation ON tenant.record
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
