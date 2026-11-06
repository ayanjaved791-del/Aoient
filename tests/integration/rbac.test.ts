import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase, systemRoleId } from "../support/db";
import { leaveOrganization, removeMember, updateMember, updateOrganization } from "@/server/organizations/organizations";
import { createInvitation } from "@/server/organizations/invitations";
import { createCustomRole, deleteCustomRole, updateCustomRole } from "@/server/organizations/roles";
import { resolveOrgContext } from "@/server/tenancy/context";

describe("RBAC and privilege escalation", () => {
  let s: Awaited<ReturnType<typeof createOrgWithOwner>>;
  beforeEach(async () => {
    await resetDatabase();
    s = await createOrgWithOwner("acme");
  });

  it("employees cannot invite, manage members or edit settings", async () => {
    const emp = await addMember(s.org.id, "employee");
    const empRole = await systemRoleId("employee");
    await expect(createInvitation(emp.ctx, { email: "a@b.test", roleId: empRole })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateOrganization(emp.ctx, { name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateMember(emp.ctx, s.ctx.memberId, { status: "suspended" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCustomRole(emp.ctx, { name: "Mine", permissions: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admins cannot grant Owner, change owners, or escalate via billing.manage", async () => {
    const admin = await addMember(s.org.id, "admin");
    const emp = await addMember(s.org.id, "employee");
    const ownerRole = await systemRoleId("owner");
    await expect(createInvitation(admin.ctx, { email: "o@b.test", roleId: ownerRole })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateMember(admin.ctx, emp.member.id, { roleId: ownerRole })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateMember(admin.ctx, s.ctx.memberId, { status: "suspended" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeMember(admin.ctx, s.ctx.memberId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCustomRole(admin.ctx, { name: "Billing", permissions: ["billing.manage"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateMember(admin.ctx, admin.member.id, { roleId: ownerRole })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unknown permission keys in custom roles", async () => {
    await expect(createCustomRole(s.ctx, { name: "Weird", permissions: ["organization.*"] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("custom roles grant exactly their permissions and are audited", async () => {
    const role = await createCustomRole(s.ctx, { name: "Recruiter", permissions: ["organization.read", "organization.members.read", "organization.members.invite"] });
    const emp = await addMember(s.org.id, "employee");
    await updateMember(s.ctx, emp.member.id, { roleId: role.id });
    const ctx = await resolveOrgContext(emp.user.id, { id: s.org.id });
    expect([...ctx.permissions].sort()).toEqual(["organization.members.invite", "organization.members.read", "organization.read"]);
    // Recruiter can invite as a role within their own permissions...
    await expect(createInvitation(ctx, { email: "r@b.test", roleId: role.id })).resolves.toBeDefined();
    // ...but not as Employee, which carries permissions they lack.
    await expect(createInvitation(ctx, { email: "e@b.test", roleId: await systemRoleId("employee") })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await updateCustomRole(s.ctx, role.id, { name: "Recruiter", permissions: ["organization.read"] });
    const after = await resolveOrgContext(emp.user.id, { id: s.org.id });
    expect([...after.permissions]).toEqual(["organization.read"]);

    await expect(deleteCustomRole(s.ctx, role.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const actions = (await db()<{ action: string }[]>`select action from audit_log where organization_id = ${s.org.id}`).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["organization.created", "role.created", "member.role_changed", "role.updated", "member.invited"]));
  });

  it("keeps at least one active owner", async () => {
    const admin = await addMember(s.org.id, "admin");
    await expect(leaveOrganization(s.ctx)).rejects.toMatchObject({ code: "CONFLICT" });

    // A second owner makes demotion and leaving possible.
    const second = await addMember(s.org.id, "owner");
    await updateMember(second.ctx, s.ctx.memberId, { roleId: await systemRoleId("admin") });
    await expect(updateMember(second.ctx, admin.member.id, { roleId: await systemRoleId("employee") })).resolves.toBeUndefined();
    const ownerCount = (await db()`select count(*)::int as n from organization_member m join role r on r.id = m.role_id where m.organization_id = ${s.org.id} and r.key = 'owner'`)[0].n;
    expect(ownerCount).toBe(1);
    await expect(leaveOrganization(second.ctx)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updating the organization only changes supplied fields", async () => {
    await updateOrganization(s.ctx, { timezone: "Asia/Karachi", currency: "pkr" });
    const updated = await updateOrganization(s.ctx, { name: "Acme Studio" });
    expect(updated).toMatchObject({ name: "Acme Studio", timezone: "Asia/Karachi", currency: "PKR" });
  });
});
