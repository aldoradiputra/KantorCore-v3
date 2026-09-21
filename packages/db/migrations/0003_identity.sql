-- Identity in the platform schema (ARCH §4, §5). Tables user/session/account/
-- verification/organization/member/invitation match Better Auth 1.7's schema
-- (organization plugin) exactly, so Better Auth drives them at runtime while our
-- migration runner owns the DDL. Column names are Better Auth's camelCase (quoted).
-- A Better Auth "organization" IS a tenant (A6 design decision). Applied as kc_migrator.

-- Core identity ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform."user" (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image         text,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.session (
  id            text PRIMARY KEY,
  "expiresAt"   timestamptz NOT NULL,
  token         text NOT NULL UNIQUE,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now(),
  "ipAddress"   text,
  "userAgent"   text,
  "userId"      text NOT NULL REFERENCES platform."user"(id) ON DELETE CASCADE,
  "activeOrganizationId" text
);
CREATE INDEX IF NOT EXISTS session_user_idx ON platform.session ("userId");

CREATE TABLE IF NOT EXISTS platform.account (
  id            text PRIMARY KEY,
  "accountId"   text NOT NULL,
  "providerId"  text NOT NULL,
  "userId"      text NOT NULL REFERENCES platform."user"(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken"     text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope         text,
  password      text,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_user_idx ON platform.account ("userId");

CREATE TABLE IF NOT EXISTS platform.verification (
  id            text PRIMARY KEY,
  identifier    text NOT NULL,
  value         text NOT NULL,
  "expiresAt"   timestamptz NOT NULL,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);

-- Organizations = tenants; members = memberships (D18) --------------------------
CREATE TABLE IF NOT EXISTS platform.organization (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  logo          text,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  metadata      text
);

CREATE TABLE IF NOT EXISTS platform.member (
  id               text PRIMARY KEY,
  "organizationId" text NOT NULL REFERENCES platform.organization(id) ON DELETE CASCADE,
  "userId"         text NOT NULL REFERENCES platform."user"(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'member',
  "createdAt"      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS member_org_user_idx
  ON platform.member ("organizationId", "userId");

CREATE TABLE IF NOT EXISTS platform.invitation (
  id               text PRIMARY KEY,
  "organizationId" text NOT NULL REFERENCES platform.organization(id) ON DELETE CASCADE,
  email            text NOT NULL,
  role             text,
  status           text NOT NULL DEFAULT 'pending',
  "expiresAt"      timestamptz NOT NULL,
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  "inviterId"      text NOT NULL REFERENCES platform."user"(id) ON DELETE CASCADE
);

-- Non-human identities (agents, service accounts). Present from the start; they
-- carry NO rights until an nhi_grant is created (ARCH §5).
CREATE TABLE IF NOT EXISTS platform.non_human_identity (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  label       text NOT NULL,
  kind        text NOT NULL DEFAULT 'service',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.nhi_grant (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  nhi_id      uuid NOT NULL REFERENCES platform.non_human_identity(id) ON DELETE CASCADE,
  tenant_id   text NOT NULL,           -- = organization.id
  role        text NOT NULL,
  company_id  uuid,
  branch_id   uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nhi_id, tenant_id)
);

-- The app role drives identity/authz reads and writes. (Platform tables are global;
-- per-user RLS on platform is a later refinement.)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  platform."user", platform.session, platform.account, platform.verification,
  platform.organization, platform.member, platform.invitation,
  platform.non_human_identity, platform.nhi_grant
  TO kc_tenant;
