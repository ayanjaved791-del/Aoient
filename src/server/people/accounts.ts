import "server-only";
import { z } from "zod";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertAdminSeat, assertMemberSeat, assertWritable, occupiesAdminSeat } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { canActOnMember, canGrantRole } from "@/server/permissions/evaluator";
import { isPermissionKey } from "@/server/permissions/catalog";
import { loadAssignableRole, listRoles } from "@/server/organizations/roles";
import { createAuthUser, deleteAuthUser, setAuthUserPassword, type AdminOptions } from "@/server/auth/admin";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";

export const loginPasswordSchema = z.string().min(10, "Use at least 10 characters").max(128, "Use 128 characters or fewer");
const createLoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: loginPasswordSchema,
  roleId: z.string().min(1, "Choose a role"),
});

export interface EmployeeLogin {
  /** The person's current sign-in email (follows their own changes). */
  email: string;
  roleName: string;
  memberStatus: "active" | "suspended";
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  /** True when this organization created the login and may set a temporary password. */
  canResetPassword: boolean;
}

/** Roles the viewer may hand out (same rule as invitations). */
export async function listGrantableRoles(ctx: OrgContext): Promise<{ id: string; name: string; description: string | null }[]> {
  if (!can(ctx, "organization.members.invite")) return [];
  const roles = await listRoles(ctx);
  return roles
    .filter((r) => canGrantRole(ctx, { key: r.key, isSystem: r.isSystem, permissions: new Set(r.permissions.filter(isPermissionKey)) }).allowed)
    .map((r) => ({ id: r.id, name: r.name, description: r.description }));
}

/** Login details for an employee record linked to a member of this organization. */
export async function getEmployeeLogin(ctx: OrgContext, employeeId: string): Promise<EmployeeLogin | null> {
  if (!isUuid(employeeId)) return null;
  const [row] = await getDb()<{
    member_id: string; email: string; role_name: string; role_key: string; is_system: boolean; permissions: string[]; status: "active" | "suspended";
    must_change_password: boolean; password_changed_at: Date | null; managed_by: string | null; other_orgs: number; user_id: string;
  }[]>`
    select m.id as member_id, p.email, r.name as role_name, r.key as role_key, r.is_system, m.status, p.must_change_password, p.password_changed_at,
           p.managed_by_organization_id as managed_by, m.user_id,
           coalesce((select array_agg(pp.key) from role_permission rp join permission pp on pp.id = rp.permission_id where rp.role_id = r.id), '{}') as permissions,
           (select count(*)::int from organization_member o where o.user_id = m.user_id and o.organization_id <> ${ctx.organizationId}) as other_orgs
    from employee e
    join organization_member m on m.id = e.member_id and m.organization_id = e.organization_id
    join profile p on p.id = m.user_id
    join role r on r.id = m.role_id
    where e.id = ${employeeId} and e.organization_id = ${ctx.organizationId}`;
  if (!row) return null;
  const actOn = canActOnMember(ctx, { memberId: row.member_id, role: { key: row.role_key, isSystem: row.is_system, permissions: new Set(row.permissions.filter(isPermissionKey)) } }).allowed;
  return {
    email: row.email, roleName: row.role_name, memberStatus: row.status, mustChangePassword: row.must_change_password, passwordChangedAt: row.password_changed_at,
    canResetPassword: can(ctx, "organization.members.manage") && actOn && row.managed_by === ctx.organizationId && row.other_orgs === 0,
  };
}

/**
 * Creates an email + temporary password login for an employee and adds them to
 * the workspace with the chosen role. They must pick their own password at first
 * sign-in. The password is never stored by Aoient or written to the audit log.
 */
export async function createEmployeeLogin(ctx: OrgContext, employeeId: string, input: unknown, admin: AdminOptions = {}): Promise<{ email: string }> {
  assertPermission(ctx, "people.employee.update");
  assertPermission(ctx, "organization.members.invite");
  // The new login would see this record's private details, so the creator must be allowed to as well.
  assertPermission(ctx, "people.employee.sensitive.read");
  if (!isUuid(employeeId)) throw new NotFoundError("Employee not found");
  const data = parseInput(createLoginSchema, input);

  // 1. Check everything we can before creating anything outside our database.
  const { employeeName, roleName, roleId } = await transaction(async (tx) => {
    await tx`select 1 from organization where id = ${ctx.organizationId} for update`;
    const license = await assertWritable(tx, ctx.organizationId);
    const [emp] = await tx<{ full_name: string; member_id: string | null; status: string }[]>`
      select full_name, member_id, status from employee where id = ${employeeId} and organization_id = ${ctx.organizationId}`;
    if (!emp) throw new NotFoundError("Employee not found");
    if (emp.member_id) throw new ConflictError("This employee already has an Aoient login.");
    if (emp.status !== "active") throw new ConflictError("Restore this employee before creating a login.");
    const role = await loadAssignableRole(tx, ctx.organizationId, data.roleId);
    const grant = canGrantRole(ctx, role);
    if (!grant.allowed) throw new ForbiddenError(grant.reason);
    const [taken] = await tx`select 1 from profile where lower(email) = ${data.email}`;
    if (taken) throw new ConflictError("This email already has an Aoient account. Send them an invite link instead, so they join with their existing password.");
    await assertMemberSeat(tx, ctx.organizationId, license);
    if (occupiesAdminSeat(role)) await assertAdminSeat(tx, ctx.organizationId, license);
    return { employeeName: emp.full_name, roleName: role.name, roleId: role.id };
  });

  // 2. Create the login in Supabase Auth (its trigger creates the profile row).
  const userId = await createAuthUser({ email: data.email, password: data.password, name: employeeName }, admin);

  // 3. Membership + link, re-checking seats under the lock. Undo the login if this fails.
  try {
    await transaction(async (tx) => {
      await tx`select 1 from organization where id = ${ctx.organizationId} for update`;
      const license = await assertWritable(tx, ctx.organizationId);
      const role = await loadAssignableRole(tx, ctx.organizationId, roleId);
      await assertMemberSeat(tx, ctx.organizationId, license);
      if (occupiesAdminSeat(role)) await assertAdminSeat(tx, ctx.organizationId, license);
      const [member] = await tx<{ id: string }[]>`
        insert into organization_member (organization_id, user_id, role_id) values (${ctx.organizationId}, ${userId}, ${roleId}) returning id`;
      const linked = await tx`
        update employee set member_id = ${member.id}, work_email = coalesce(work_email, ${data.email}), updated_at = now()
        where id = ${employeeId} and organization_id = ${ctx.organizationId} and member_id is null`;
      if (linked.count === 0) throw new ConflictError("This employee was linked to a login a moment ago.");
      await tx`
        update profile set must_change_password = true, managed_by_organization_id = ${ctx.organizationId}, email_verified = true, updated_at = now()
        where id = ${userId}`;
      await recordAudit(tx, {
        organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.login_created",
        targetType: "member", targetId: member.id, metadata: { userId, email: data.email, role: roleName, name: employeeName },
      });
    });
  } catch (e) {
    await deleteAuthUser(userId, admin);
    throw e;
  }
  return { email: data.email };
}

/**
 * Sets a new temporary password for a login this organization created. Refused
 * when the person also belongs to another organization: their account is then
 * theirs, and only they can reset it (with "Forgot password").
 */
export async function resetEmployeePassword(ctx: OrgContext, employeeId: string, input: unknown, admin: AdminOptions = {}): Promise<void> {
  assertPermission(ctx, "organization.members.manage");
  const password = parseInput(z.object({ password: loginPasswordSchema }), input).password;
  const login = await getEmployeeLogin(ctx, employeeId);
  if (!login) throw new NotFoundError("This employee has no login in this workspace.");
  if (!login.canResetPassword) {
    throw new ForbiddenError("You can only set a password for logins this workspace created, for people who aren't in other workspaces and whose role you can manage. They can use “Forgot password” instead.");
  }
  const [row] = await getDb()<{ user_id: string; member_id: string }[]>`
    select m.user_id, m.id as member_id from employee e join organization_member m on m.id = e.member_id
    where e.id = ${employeeId} and e.organization_id = ${ctx.organizationId}`;
  await setAuthUserPassword(row.user_id, password, admin);
  await transaction(async (tx) => {
    await tx`update profile set must_change_password = true, updated_at = now() where id = ${row.user_id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.password_reset", targetType: "member", targetId: row.member_id, metadata: { userId: row.user_id } });
  });
}
