import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import type { Pool } from "pg";

export interface AuthConfig {
  /** node-postgres Pool. Point its search_path at the `platform` schema. */
  pool: Pool;
  /** >= 32 chars; from the environment, never hard-coded (D54). */
  secret: string;
  baseURL: string;
}

/**
 * The KantorCore auth instance: one global login (email/password now; passkeys and
 * SSO later) with memberships in many tenants via the organization plugin — a Better
 * Auth "organization" is a tenant (D18, A6). Opaque DB sessions. The schema lives in
 * the `platform` schema and is owned by our migrations (0003_identity.sql).
 */
export function makeAuth(config: AuthConfig) {
  return betterAuth({
    database: config.pool,
    secret: config.secret,
    baseURL: config.baseURL,
    emailAndPassword: { enabled: true },
    plugins: [organization()],
  });
}

export type Auth = ReturnType<typeof makeAuth>;
