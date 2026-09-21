import type { Sql } from "postgres";

export type PrincipalKind = "user" | "nhi";

export interface Principal {
  kind: PrincipalKind;
  /** platform."user".id for a user, or platform.non_human_identity.id for an nhi. */
  id: string;
}

export interface Resource {
  /** = organization.id (the tenant). */
  tenantId: string;
}

// Role -> permission policy (D8). "*" means every action. Kept deliberately small
// for 0a; richer permissions arrive with the metadata/model work.
const ROLE_POLICY: Record<string, "*" | ReadonlySet<string>> = {
  owner: "*",
  admin: "*",
  member: new Set<string>(["record.read", "record.create"]),
};

/** Pure policy check: does this role permit this action? */
export function permits(role: string | null | undefined, action: string): boolean {
  if (!role) return false;
  const policy = ROLE_POLICY[role];
  if (!policy) return false;
  return policy === "*" || policy.has(action);
}

async function roleFor(
  sql: Sql,
  principal: Principal,
  tenantId: string,
): Promise<string | null> {
  if (principal.kind === "user") {
    const rows = await sql<{ role: string }[]>`
      select role from platform.member
      where "userId" = ${principal.id} and "organizationId" = ${tenantId}
      limit 1
    `;
    return rows[0]?.role ?? null;
  }
  const rows = await sql<{ role: string }[]>`
    select role from platform.nhi_grant
    where nhi_id = ${principal.id} and tenant_id = ${tenantId}
    limit 1
  `;
  return rows[0]?.role ?? null;
}

/**
 * The typed authorization gate (D8). True iff the principal's role in the resource's
 * tenant permits the action. A principal with no membership/grant in that tenant is
 * denied — so a non-human identity is inert until granted (ARCH §5). RLS is the
 * database safety net underneath this.
 */
export async function can(
  sql: Sql,
  principal: Principal,
  action: string,
  resource: Resource,
): Promise<boolean> {
  const role = await roleFor(sql, principal, resource.tenantId);
  return permits(role, action);
}
