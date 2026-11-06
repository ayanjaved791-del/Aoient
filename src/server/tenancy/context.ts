import "server-only";
import { db } from "@/server/database/client";
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
  const member = await db.organizationMember.findFirst({
    where: {
      userId,
      status: "active",
      organization: { status: "active", ...("slug" in ref ? { slug: ref.slug } : { id: ref.id }) },
    },
    select: {
      id: true,
      organization: { select: { id: true, name: true, slug: true, timezone: true, currency: true } },
      role: {
        select: {
          id: true,
          key: true,
          name: true,
          isSystem: true,
          organizationId: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  if (!member) throw new NotFoundError("Organization not found");

  // Defence in depth: a custom role must belong to the same tenant.
  if (member.role.organizationId !== null && member.role.organizationId !== member.organization.id) {
    throw new NotFoundError("Organization not found");
  }

  const permissions = new Set<PermissionKey>();
  for (const rp of member.role.permissions) {
    if (isPermissionKey(rp.permission.key)) permissions.add(rp.permission.key);
  }

  const subject = { roleKey: member.role.key, isSystemRole: member.role.isSystem, permissions };

  return {
    ...subject,
    userId,
    organizationId: member.organization.id,
    organization: member.organization,
    memberId: member.id,
    roleId: member.role.id,
    roleName: member.role.name,
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
