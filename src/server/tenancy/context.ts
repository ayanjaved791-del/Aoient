import "server-only";
import { getDb } from "@/server/database/client";
import { isUuid } from "@/lib/ids";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isPermissionKey, type PermissionKey } from "@/server/permissions/catalog";
import { hasPermission, isOwner as subjectIsOwner, type PermissionSubject } from "@/server/permissions/evaluator";

/**
 * A verified tenant context. It can only be produced by `resolveOrgContext`,
 * which proves — from the database, not the browser — that `userId` is an
 * active member of `organizationId`. Every tenant-owned service function takes
 * this object and scopes its queries with `ctx.organizationId`.
 */
export interface OrgContext extends PermissionSubject {
  readonly userId: string;
  readonly organizationId: string;
  readonly organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
  };
  readonly memberId: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly isOwner: boolean;
}

export type OrgRef = { slug: string } | { id: string };

/**
 * Spec §3 evaluation order: (session already authenticated by caller) →
 * resolve organization → verify active membership → load role permissions.
 *
 * Unknown organizations, organizations the user does not belong to, suspended
 * memberships and inactive organizations all produce the same NotFoundError so
 * callers cannot probe for the existence of other tenants.
 */
export async function resolveOrgContext(userId: string, ref: OrgRef): Promise<OrgContext> {
  if (!isUuid(userId) || ("id" in ref && !isUuid(ref.id))) throw new NotFoundError("Organization not found");
  const sql = getDb();
  const [row] = await sql<{
    member_id: string; org_id: string; org_name: string; slug: string; timezone: string; currency: string;
    role_id: string; role_key: string; role_name: string; is_system: boolean; role_org_id: string | null; permissions: string[];
  }[]>`
    select m.id as member_id, o.id as org_id, o.name as org_name, o.slug, o.timezone, o.currency,
           r.id as role_id, r.key as role_key, r.name as role_name, r.is_system, r.organization_id as role_org_id,
           coalesce(array_agg(p.key) filter (where p.key is not null), '{}') as permissions
    from organization_member m
    join organization o on o.id = m.organization_id
    join role r on r.id = m.role_id
    left join role_permission rp on rp.role_id = r.id
    left join permission p on p.id = rp.permission_id
    where m.user_id = ${userId} and m.status = 'active' and o.status = 'active'
      and ${"slug" in ref ? sql`o.slug = ${ref.slug}` : sql`o.id = ${ref.id}`}
    group by m.id, o.id, r.id`;

  if (!row) throw new NotFoundError("Organization not found");

  // Defence in depth: a custom role must belong to the same tenant.
  if (row.role_org_id !== null && row.role_org_id !== row.org_id) throw new NotFoundError("Organization not found");

  const permissions = new Set<PermissionKey>(row.permissions.filter(isPermissionKey));
  const subject = { roleKey: row.role_key, isSystemRole: row.is_system, permissions };

  return {
    ...subject,
    userId,
    organizationId: row.org_id,
    organization: { id: row.org_id, name: row.org_name, slug: row.slug, timezone: row.timezone, currency: row.currency.trim() },
    memberId: row.member_id,
    roleId: row.role_id,
    roleName: row.role_name,
    isOwner: subjectIsOwner(subject),
  };
}

/** Throws ForbiddenError unless the context holds the permission. */
export function assertPermission(ctx: OrgContext, permission: PermissionKey): void {
  if (!hasPermission(ctx, permission)) throw new ForbiddenError();
}

export function can(ctx: OrgContext, permission: PermissionKey): boolean {
  return hasPermission(ctx, permission);
}
