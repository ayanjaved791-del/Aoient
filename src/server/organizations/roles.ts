import "server-only";
import { getDb, transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { isPermissionKey, MODULES, PERMISSIONS, type PermissionKey } from "@/server/permissions/catalog";
import { isSubsetOf, type RoleDescriptor } from "@/server/permissions/evaluator";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
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
export async function loadAssignableRole(tx: Db, organizationId: string, roleId: string): Promise<RoleDescriptor & { id: string; name: string }> {
  if (!isUuid(roleId)) throw new NotFoundError("Role not found");
  const [role] = await tx<{ id: string; key: string; name: string; is_system: boolean; permissions: string[] }[]>`
    select r.id, r.key, r.name, r.is_system,
           coalesce(array_agg(p.key) filter (where p.key is not null), '{}') as permissions
    from role r
    left join role_permission rp on rp.role_id = r.id
    left join permission p on p.id = rp.permission_id
    where r.id = ${roleId}
      and ((r.organization_id is null and r.is_system) or r.organization_id = ${organizationId})
    group by r.id`;
  if (!role) throw new NotFoundError("Role not found");
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    isSystem: role.is_system,
    permissions: new Set(role.permissions.filter(isPermissionKey)),
  };
}

export async function listRoles(ctx: OrgContext): Promise<RoleSummary[]> {
  assertPermission(ctx, "organization.members.read");
  const sql = getDb();
  const rows = await sql<{
    id: string; key: string; name: string; description: string | null; is_system: boolean; permissions: string[]; member_count: number;
  }[]>`
    select r.id, r.key, r.name, r.description, r.is_system,
           coalesce((select array_agg(p.key) from role_permission rp join permission p on p.id = rp.permission_id
                     where rp.role_id = r.id), '{}') as permissions,
           (select count(*)::int from organization_member m where m.role_id = r.id and m.organization_id = ${ctx.organizationId}) as member_count
    from role r
    where (r.organization_id is null and r.is_system) or r.organization_id = ${ctx.organizationId}
    order by r.is_system desc, r.created_at asc`;
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.is_system,
    permissions: r.permissions.filter(isPermissionKey),
    memberCount: r.member_count,
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

async function writeGrants(tx: Db, roleId: string, keys: PermissionKey[]) {
  await tx`delete from role_permission where role_id = ${roleId}`;
  if (keys.length) {
    await tx`
      insert into role_permission (role_id, permission_id)
      select ${roleId}, id from permission where key = any(${keys}::text[])`;
  }
}

async function assertNameFree(tx: Db, organizationId: string, name: string, exceptId?: string) {
  const [taken] = await tx`
    select 1 from role
    where organization_id = ${organizationId} and lower(name) = lower(${name})
      ${exceptId ? tx`and id <> ${exceptId}` : tx``}`;
  if (taken) throw new ConflictError("A role with this name already exists.");
}

export async function createCustomRole(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "organization.roles.manage");
  const data = parseInput(roleSchema, input);
  const keys = validatePermissionKeys(ctx, data.permissions);
  const baseKey = `custom-${slugify(data.name) || "role"}`;

  return transaction(async (tx) => {
    let key = baseKey;
    for (let i = 2; (await tx`select 1 from role where organization_id = ${ctx.organizationId} and key = ${key}`).length; i++) {
      key = `${baseKey}-${i}`;
    }
    await assertNameFree(tx, ctx.organizationId, data.name);

    const [role] = await tx<{ id: string }[]>`
      insert into role (organization_id, key, name, description, is_system)
      values (${ctx.organizationId}, ${key}, ${data.name}, ${data.description || null}, false)
      returning id`;
    await writeGrants(tx, role.id, keys);
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "role.created",
      targetType: "role", targetId: role.id, metadata: { name: data.name, permissions: keys },
    });
    return { id: role.id };
  });
}

async function loadCustomRole(tx: Db, ctx: OrgContext, roleId: string) {
  if (!isUuid(roleId)) throw new NotFoundError("Role not found");
  const [role] = await tx<{ id: string; name: string }[]>`
    select id, name from role where id = ${roleId} and organization_id = ${ctx.organizationId} and not is_system`;
  if (!role) throw new NotFoundError("Role not found");
  return role;
}

export async function updateCustomRole(ctx: OrgContext, roleId: string, input: unknown): Promise<void> {
  assertPermission(ctx, "organization.roles.manage");
  const data = parseInput(roleSchema, input);
  const keys = validatePermissionKeys(ctx, data.permissions);

  await transaction(async (tx) => {
    const role = await loadCustomRole(tx, ctx, roleId);
    if (role.id === ctx.roleId) throw new ForbiddenError("You cannot edit the role you are using.");
    // Editing a role must not let you act on members more privileged than you.
    const current = await loadAssignableRole(tx, ctx.organizationId, role.id);
    if (!isSubsetOf(current.permissions, ctx.permissions)) throw new ForbiddenError("This role has permissions you do not hold.");
    await assertNameFree(tx, ctx.organizationId, data.name, role.id);

    await tx`update role set name = ${data.name}, description = ${data.description || null}, updated_at = now() where id = ${role.id}`;
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
  await transaction(async (tx) => {
    const role = await loadCustomRole(tx, ctx, roleId);
    const [{ in_use }] = await tx<{ in_use: boolean }[]>`
      select exists (select 1 from organization_member where role_id = ${role.id})
          or exists (select 1 from invitation where role_id = ${role.id} and status = 'pending') as in_use`;
    if (in_use) {
      throw new ConflictError("Reassign members and revoke pending invitations using this role before deleting it.");
    }
    await tx`delete from role where id = ${role.id}`;
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "role.deleted",
      targetType: "role", targetId: role.id, metadata: { name: role.name },
    });
  });
}
