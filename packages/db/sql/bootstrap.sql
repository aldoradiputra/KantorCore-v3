-- Cluster bootstrap for LOCAL DEV + TEST. Run once as a superuser
-- (docker-entrypoint-initdb.d on first init, or the test harness).
-- Production roles/secrets are provisioned by A3 infra, never from this file.
-- Passwords here are DEV-ONLY and must never be used outside local/test.

-- Extensions (D5).
CREATE EXTENSION IF NOT EXISTS vector;

-- Schemas (ARCH §4).
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS control;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS tenant;

-- Roles (idempotent). NOBYPASSRLS stated explicitly for intent (ARCH §4).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kc_migrator') THEN
    CREATE ROLE kc_migrator LOGIN PASSWORD 'kc_migrator_dev' NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kc_tenant') THEN
    CREATE ROLE kc_tenant LOGIN PASSWORD 'kc_tenant_dev' NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kc_control') THEN
    CREATE ROLE kc_control LOGIN PASSWORD 'kc_control_dev' NOBYPASSRLS;
  END IF;
END $$;

-- kc_migrator: DDL across all schemas (CI migrate step only).
GRANT USAGE, CREATE ON SCHEMA platform, control, catalog, tenant TO kc_migrator;

-- kc_tenant: works in the tenant plane; reads the catalog; touches own platform rows.
GRANT USAGE ON SCHEMA tenant, catalog, platform TO kc_tenant;

-- kc_control: control plane only. Deliberately NO usage on the tenant schema —
-- it reaches tenant data only through scrubbed views later (D42).
GRANT USAGE ON SCHEMA control TO kc_control;

-- Default privileges: tables kc_migrator creates auto-grant to the app roles.
ALTER DEFAULT PRIVILEGES FOR ROLE kc_migrator IN SCHEMA tenant
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kc_tenant;
ALTER DEFAULT PRIVILEGES FOR ROLE kc_migrator IN SCHEMA tenant
  GRANT USAGE, SELECT ON SEQUENCES TO kc_tenant;
ALTER DEFAULT PRIVILEGES FOR ROLE kc_migrator IN SCHEMA catalog
  GRANT SELECT ON TABLES TO kc_tenant;
ALTER DEFAULT PRIVILEGES FOR ROLE kc_migrator IN SCHEMA control
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kc_control;
