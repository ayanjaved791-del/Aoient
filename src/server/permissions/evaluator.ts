/**
 * Central, pure RBAC evaluator. No database or framework access so it can be
 * unit-tested exhaustively. Deny by default.
 */
import { OWNER_ROLE_KEY, type PermissionKey } from "./catalog";

export interface PermissionSubject {
  roleKey: string;
  isSystemRole: boolean;
  permissions: ReadonlySet<PermissionKey>;
}

export function hasPermission(subject: PermissionSubject, permission: PermissionKey): boolean {
  return subject.permissions.has(permission);
}

export function hasAllPermissions(subject: PermissionSubject, permissions: readonly PermissionKey[]): boolean {
  return permissions.every((p) => subject.permissions.has(p));
}

export function isOwner(subject: Pick<PermissionSubject, "roleKey" | "isSystemRole">): boolean {
  return subject.isSystemRole && subject.roleKey === OWNER_ROLE_KEY;
}

/** Returns true when every permission in `candidate` is also held by `actor`. */
export function isSubsetOf(candidate: Iterable<PermissionKey>, actor: ReadonlySet<PermissionKey>): boolean {
  for (const p of candidate) if (!actor.has(p)) return false;
  return true;
}

export interface RoleDescriptor {
  key: string;
  isSystem: boolean;
  permissions: ReadonlySet<PermissionKey>;
}

export type EscalationCheck = { allowed: true } | { allowed: false; reason: string };

/**
 * Can `actor` assign `role` to someone (via invitation or role change)?
 *  - Only owners may grant the owner role.
 *  - Nobody may grant a role carrying permissions they do not hold themselves.
 */
export function canGrantRole(actor: PermissionSubject, role: RoleDescriptor): EscalationCheck {
  if (role.isSystem && role.key === OWNER_ROLE_KEY && !isOwner(actor)) {
    return { allowed: false, reason: "Only an owner can grant the Owner role." };
  }
  if (!isSubsetOf(role.permissions, actor.permissions)) {
    return { allowed: false, reason: "You cannot grant a role with permissions you do not have." };
  }
  return { allowed: true };
}

/**
 * Can `actor` change or remove a member who currently holds `targetRole`?
 * Prevents admins from acting on owners or on members more privileged than themselves.
 */
export function canActOnMember(
  actor: PermissionSubject & { memberId: string },
  target: { memberId: string; role: RoleDescriptor },
): EscalationCheck {
  if (actor.memberId === target.memberId) {
    return { allowed: false, reason: "You cannot change your own membership here." };
  }
  if (target.role.isSystem && target.role.key === OWNER_ROLE_KEY && !isOwner(actor)) {
    return { allowed: false, reason: "Only an owner can change another owner." };
  }
  if (!isSubsetOf(target.role.permissions, actor.permissions)) {
    return { allowed: false, reason: "This member has permissions you do not hold." };
  }
  return { allowed: true };
}
