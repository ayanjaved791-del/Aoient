import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, createUser, db, resetDatabase, systemRoleId } from "../support/db";
import { setEmailProvider, type EmailMessage } from "@/server/email/provider";
import { acceptInvitation, createInvitation, getInvitationPreview, revokeInvitation } from "@/server/organizations/invitations";
import { createOrganization } from "@/server/organizations/organizations";
import { resolveOrgContext } from "@/server/tenancy/context";
import { hashToken } from "@/lib/tokens";

const outbox: EmailMessage[] = [];
setEmailProvider({ name: "test", deliversExternally: false, send: async (m) => void outbox.push(m) });
const lastToken = () => outbox.at(-1)!.text.match(/\/invite\/([A-Za-z0-9_-]+)/)![1];

describe("organization creation (AT-01)", () => {
  beforeEach(resetDatabase);

  it("creator becomes the owner with a consistent membership and audit trail", async () => {
    const user = await createUser();
    const org = await createOrganization(user, { name: "Northwind Studio", slug: "northwind", timezone: "Europe/London" });
    const ctx = await resolveOrgContext(user.id, { slug: "northwind" });
    expect(ctx.isOwner).toBe(true);
    expect(ctx.organization).toMatchObject({ id: org.id, timezone: "Europe/London", currency: "USD" });
    expect(await db.auditLog.count({ where: { organizationId: org.id, action: "organization.created", actorUserId: user.id } })).toBe(1);
  });

  it("rejects duplicate slugs and unverified users", async () => {
    const user = await createUser();
    await createOrganization(user, { name: "One", slug: "taken" });
    await expect(createOrganization(user, { name: "Two", slug: "taken" })).rejects.toMatchObject({ code: "CONFLICT" });
    const unverified = await createUser({ verified: false });
    await expect(createOrganization(unverified, { name: "Three", slug: "three" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.organization.count()).toBe(1);
  });
});

describe("invitation lifecycle (AT-03)", () => {
  let s: Awaited<ReturnType<typeof createOrgWithOwner>>;
  let employeeRole: string;
  beforeEach(async () => {
    await resetDatabase();
    outbox.length = 0;
    s = await createOrgWithOwner("acme");
    employeeRole = await systemRoleId("employee");
  });

  it("stores only a hash, accepts once, creates membership with the role, and audits", async () => {
    const { id } = await createInvitation(s.ctx, { email: "New.Hire@Example.test", roleId: employeeRole });
    const token = lastToken();
    const row = await db.invitation.findUniqueOrThrow({ where: { id } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.email).toBe("new.hire@example.test");

    const preview = await getInvitationPreview(token);
    expect(preview).toMatchObject({ state: "valid", organizationName: "Org acme", roleName: "Employee" });

    const invitee = await createUser({ email: "new.hire@example.test" });
    await expect(acceptInvitation(invitee, token)).resolves.toEqual({ organizationSlug: "acme" });
    const ctx = await resolveOrgContext(invitee.id, { slug: "acme" });
    expect(ctx.roleKey).toBe("employee");

    // Single use.
    await expect(acceptInvitation(invitee, token)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getInvitationPreview(token)).toEqual({ state: "invalid" });
    expect(await db.auditLog.count({ where: { action: "member.joined", targetId: ctx.memberId } })).toBe(1);
  });

  it("rejects a different email, unverified users, expired and revoked invitations", async () => {
    const { id } = await createInvitation(s.ctx, { email: "target@example.test", roleId: employeeRole });
    const token = lastToken();
    const stranger = await createUser({ email: "stranger@example.test" });
    await expect(acceptInvitation(stranger, token)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const unverified = await createUser({ email: "target@example.test", verified: false });
    await expect(acceptInvitation(unverified, token)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await db.invitation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await db.user.update({ where: { id: unverified.id }, data: { emailVerified: true } });
    await expect(acceptInvitation({ ...unverified, emailVerified: true }, token)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const second = await createInvitation(s.ctx, { email: "target2@example.test", roleId: employeeRole });
    const token2 = lastToken();
    await revokeInvitation(s.ctx, second.id);
    const target2 = await createUser({ email: "target2@example.test" });
    await expect(acceptInvitation(target2, token2)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(acceptInvitation(target2, "not-a-real-token")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.organizationMember.count({ where: { organizationId: s.org.id } })).toBe(1);
  });

  it("re-inviting revokes the previous link; existing members cannot be re-invited", async () => {
    await createInvitation(s.ctx, { email: "dup@example.test", roleId: employeeRole });
    const first = lastToken();
    await createInvitation(s.ctx, { email: "DUP@example.test", roleId: employeeRole });
    expect(await getInvitationPreview(first)).toEqual({ state: "invalid" });
    expect(await db.invitation.count({ where: { organizationId: s.org.id, status: "pending" } })).toBe(1);

    const member = await addMember(s.org.id, "employee", await createUser({ email: "member@example.test" }));
    expect(member.ctx.organizationId).toBe(s.org.id);
    await expect(createInvitation(s.ctx, { email: "member@example.test", roleId: employeeRole })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("concurrent accepts of one token create exactly one membership", async () => {
    await createInvitation(s.ctx, { email: "race@example.test", roleId: employeeRole });
    const token = lastToken();
    const invitee = await createUser({ email: "race@example.test" });
    const results = await Promise.allSettled([acceptInvitation(invitee, token), acceptInvitation(invitee, token), acceptInvitation(invitee, token)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.organizationMember.count({ where: { organizationId: s.org.id, userId: invitee.id } })).toBe(1);
  });
});
