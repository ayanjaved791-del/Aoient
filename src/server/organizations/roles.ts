import "server-only";
import { db, type Tx } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { isPermissionKey, MODULES, PERMISSIONS, type PermissionKey } from "@/server/permissions/catalog";
import { isSubsetOf, type RoleDescriptor } from "@/server/permissions/evaluator";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseInput } from "@/lib/validation/parse";
import { roleSchema, slugify } from "@/lib/validation/organization";

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionKey[];
  memberCount: number;
}

/**
 * Load a role that is assignable inside `organizationId`: either a shared system
 * role or a custom role owned by this organization. A custom role id from a
 * different tenant resolves to NotFound — never to that tenant's role.
 */
export async function loadAssignableRole(tx: Tx, organizationId: string, roleId: string): Promise<RoleDescriptor & { id: string; name: string }> {
  const role = await tx.role.findFirst({
    where: { id: roleId, OR: [{ organizationId: null, isSystem: true }, { organizationId }] },
    select: { id: true, key: true, name: true, isSystem: true, permissions: { select: { permission: { select: { key: true } } } } },
  });
  if (!role) throw new NotFoundError("Role not found");
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    isSystem: role.isSystem,
    permissions: new Set(role.permissions.map((p) => p.permission.key).filter(isPermissionKey)),
  };
}

export async function listRoles(ctx: OrgContext): Promise<RoleSummary[]> {
  assertPermission(ctx, "organization.members.read");
  const roles = await db.role.findMany({
    where: { OR: [{ organizationId: null, isSystem: true }, { organizationId: ctx.organizationId }] },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, key: true, name: true, description: true, isSystem: true,
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { members: { where: { organizationId: ctx.organizationId } } } },
    },
  });
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissions: r.permissions.map((p) => p.permission.key).filter(isPermissionKey),
    memberCount: r._count.members,
  }));
}

export function permissionCatalogForUi() {
  return Object.entries(MODULES).map(([module, meta]) => ({
    module,
    label: meta.label,
    released: meta.released,
    permissions: PERMISSIONS.filter((p) => p.module === module).map((p) => ({ key: p.key, description: p.description })),
  }));
}

function validatePermissionKeys(ctx: OrgContext, keys: string[]): PermissionKey[] {
  const unknown = keys.filter((k) => !isPermissionKey(k));
  if (unknown.length) throw new ValidationError("Unknown permissions", { permissions: [`Unknown: ${unknown.join(", ")}`] });
  const valid = [...new Set(keys as PermissionKey[])];
  // Privilege-escalation guard: you can only bundle permissions you hold.
  if (!isSubsetOf(valid, ctx.permissions)) {
    throw new ForbiddenError("You cannot grant permissions you do not have.");
  }
  return valid;
}

async function writeGrants(tx: Tx, roleId: string, keys: PermissionKey[]) {
  const perms = await tx.permission.findMany({ where: { key: { in: keys } }, select: { id: true } });
  await tx.rolePermission.deleteMany({ where: { roleId } });
  if (perms.length) await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) });
}

export async function createCustomRole(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "organization.roles.manage");
  const data = parseInput(roleSchema, input);
  const keys = validatePermissionKeys(ctx, data.permissions);
  const baseKey = `custom-${slugify(data.name) || "role"}`;

  return db.$transaction(async (tx) => {
    let key = baseKey;
    for (let i = 2; await tx.role.findFirst({ where: { organizationId: ctx.organizationId, key }, select: { id: true } }); i++) {
      key = `${baseKey}-${i}`;
    }
    const nameTaken = await tx.role.findFirst({
      where: { organizationId: ctx.organizationId, name: { equals: data.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (nameTaken) throw new ConflictError("A role with this name already exists.");

    const role = await tx.role.create({
      data: { organizationId: ctx.organizationId, key, name: data.name, description: data.description || null, isSystem: false },
    });
    await writeGrants(tx, role.id, keys);
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "role.created",
      targetType: "role", targetId: role.id, metadata: { name: data.name, permissions: keys },
    });
    return { id: role.id };
  });
}

async function loadCustomRole(tx: Tx, ctx: OrgContext, roleId: string) {
  const role = await tx.role.findFirst({ where: { id: roleId, organizationId: ctx.organizationId, isSystem: false } });
  if (!role) throw new NotFoundError("Role not found");
  return role;
}

export async function updateCustomRole(ctx: OrgContext, roleId: string, input: unknown): Promise<void> {
  assertPermission(ctx, "organization.roles.manage");
  const data = parseInput(roleSchema, input);
  const keys = validatePermissionKeys(ctx, data.permissions);

  await db.$transaction(async (tx) => {
    const role = await loadCustomRole(tx, ctx, roleId);
    if (role.id === ctx.roleId) throw new ForbiddenError("You cannot edit the role you are using.");
    // Editing a role must not let you act on members more privileged than you.
    const current = await loadAssignableRole(tx, ctx.organizationId, role.id);
    if (!isSubsetOf(current.permissions, ctx.permissions)) throw new ForbiddenError("This role has permissions you do not hold.");

    const nameTaken = await tx.role.findFirst({
      where: { organizationId: ctx.organizationId, name: { equals: data.name, mode: "insensitive" }, NOT: { id: role.id } },
      select: { id: true },
    });
    if (nameTaken) throw new ConflictError("A role with this name already exists.");

    await tx.role.update({ where: { id: role.id }, data: { name: data.name, description: data.description || null } });
    await writeGrants(tx, role.id, keys);
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "role.updated",
      targetType: "role", targetId: role.id,
      metadata: { name: data.name, before: [...current.permissions], after: keys },
    });
  });
}

export async function deleteCustomRole(ctx: OrgContext, roleId: string): Promise<void> {
  assertPermission(ctx, "organization.roles.manage");
  await db.$transaction(async (tx) => {
    const role = await loadCustomRole(tx, ctx, roleId);
    const inUse = await tx.organizationMember.count({ where: { roleId: role.id } });
    const pendingInvites = await tx.invitation.count({ where: { roleId: role.id, status: "pending" } });
    if (inUse || pendingInvites) {
      throw new ConflictError("Reassign members and revoke pending invitations using this role before deleting it.");
    }
    await tx.role.delete({ where: { id: role.id } });
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "role.deleted",
      targetType: "role", targetId: role.id, metadata: { name: role.name },
    });
  });
}
