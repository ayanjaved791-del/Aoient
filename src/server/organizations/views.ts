import "server-only";
import { db } from "@/server/database/client";
import { can, type OrgContext } from "@/server/tenancy/context";
import { isPermissionKey } from "@/server/permissions/catalog";
import { canActOnMember, canGrantRole, type RoleDescriptor } from "@/server/permissions/evaluator";
import { listMembers } from "./organizations";
import { listPendingInvitations } from "./invitations";
import { listRoles } from "./roles";

/**
 * Read model for the Members screen. Action flags are computed with the same
 * evaluator the mutations use, so the UI never offers an action the server
 * would refuse (the server still re-checks on submit).
 */
export async function getMembersView(ctx: OrgContext, opts: { query?: string; status?: "active" | "suspended" }) {
  const [members, roles, invitations, total] = await Promise.all([
    listMembers(ctx, opts),
    listRoles(ctx),
    listPendingInvitations(ctx),
    db.organizationMember.count({ where: { organizationId: ctx.organizationId } }),
  ]);
  const descriptors = new Map<string, RoleDescriptor>(
    roles.map((r) => [r.id, { key: r.key, isSystem: r.isSystem, permissions: new Set(r.permissions.filter(isPermissionKey)) }]),
  );
  const grantableRoles = roles
    .filter((r) => canGrantRole(ctx, descriptors.get(r.id)!).allowed)
    .map((r) => ({ id: r.id, name: r.name, description: r.description }));

  const canManage = can(ctx, "organization.members.manage");
  const canRemove = can(ctx, "organization.members.remove");

  return {
    total,
    grantableRoles,
    canInvite: can(ctx, "organization.members.invite") && grantableRoles.length > 0,
    invitations,
    members: members.map((m) => {
      const allowed = canActOnMember(ctx, { memberId: m.id, role: descriptors.get(m.role.id)! }).allowed;
      return { ...m, isSelf: m.id === ctx.memberId, canManage: canManage && allowed, canRemove: canRemove && allowed };
    }),
  };
}
