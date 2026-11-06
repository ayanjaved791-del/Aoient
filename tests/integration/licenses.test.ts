import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, createUser, db, resetDatabase, setLicense, systemRoleId } from "../support/db";
import { setEmailProvider, type EmailMessage } from "@/server/email/provider";
import { acceptInvitation, createInvitation, revokeInvitation } from "@/server/organizations/invitations";
import { listMembers, removeMember, updateMember, updateOrganization } from "@/server/organizations/organizations";
import { createCustomRole } from "@/server/organizations/roles";
import { getLicenseOverview } from "@/server/billing/license";

const outbox: EmailMessage[] = [];
setEmailProvider({ name: "test", deliversExternally: false, send: async (m) => void outbox.push(m) });
const lastToken = () => outbox.at(-1)!.text.match(/\/invite\/([A-Za-z0-9_-]+)/)![1];
const DAY = 86_400_000;
const PLAN_LIMIT = { code: "PLAN_LIMIT" };

describe("licenses: trial on creation", () => {
  beforeEach(resetDatabase);

  it("a new organization starts a 14-day Medisea trial", async () => {
    const { org } = await createOrgWithOwner("fresh", undefined, { license: "trial" });
    const { license, usage } = await getLicenseOverview(org.id);
    expect(license).toMatchObject({ plan: "medisea", status: "trialing", source: "trial", state: "trial" });
    const days = (license!.trialEndsAt!.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
    expect(usage).toMatchObject({ activeMembers: 1, adminSeats: 1, pendingInvitations: 0 });
  });
});

describe("licenses: plan limits are enforced on the server", () => {
  let employee: string;
  let admin: string;
  beforeEach(async () => {
    await resetDatabase();
    outbox.length = 0;
    employee = await systemRoleId("employee");
    admin = await systemRoleId("admin");
  });

  it("Medisea: members + pending invitations can't exceed 5", async () => {
    const { ctx } = await createOrgWithOwner("small", undefined, { license: "trial" });
    for (let i = 1; i <= 4; i++) await createInvitation(ctx, { email: `p${i}@example.test`, roleId: employee });
    await expect(createInvitation(ctx, { email: "p5@example.test", roleId: employee })).rejects.toMatchObject(PLAN_LIMIT);
    // Re-inviting the same person replaces their invitation, so it doesn't need a new seat.
    await expect(createInvitation(ctx, { email: "p1@example.test", roleId: employee })).resolves.toBeDefined();
    // Freeing a seat makes room again.
    const [inv] = await db()<{ id: string }[]>`select id from invitation where email = 'p2@example.test' and status = 'pending'`;
    await revokeInvitation(ctx, inv.id);
    await expect(createInvitation(ctx, { email: "p5@example.test", roleId: employee })).resolves.toBeDefined();
  });

  it("Medisea: the owner holds the only admin seat; Indiana allows 3", async () => {
    const { org, ctx } = await createOrgWithOwner("seats", undefined, { license: "trial" });
    await expect(createInvitation(ctx, { email: "boss@example.test", roleId: admin })).rejects.toMatchObject(PLAN_LIMIT);
    const { member: m } = await addMember(org.id, "employee");
    await expect(updateMember(ctx, m.id, { roleId: admin })).rejects.toMatchObject(PLAN_LIMIT);

    await setLicense(org.id, { plan: "indiana", status: "active" });
    await expect(updateMember(ctx, m.id, { roleId: admin })).resolves.toBeUndefined();
    await expect(createInvitation(ctx, { email: "boss@example.test", roleId: admin })).resolves.toBeDefined();
    // 3 seats: owner + promoted member + pending admin invitation.
    await expect(createInvitation(ctx, { email: "boss2@example.test", roleId: admin })).rejects.toMatchObject(PLAN_LIMIT);
  });

  it("reactivating a suspended member needs a free seat", async () => {
    const { org, ctx } = await createOrgWithOwner("react", undefined, { license: "trial" });
    const members = [];
    for (let i = 0; i < 4; i++) members.push((await addMember(org.id, "employee")).member);
    await updateMember(ctx, members[0].id, { status: "suspended" });
    await createInvitation(ctx, { email: "late@example.test", roleId: employee });
    await expect(updateMember(ctx, members[0].id, { status: "active" })).rejects.toMatchObject(PLAN_LIMIT);
  });

  it("accepting an invitation re-checks the limit at join time", async () => {
    const { org, ctx } = await createOrgWithOwner("join", undefined, { license: "trial" });
    await createInvitation(ctx, { email: "invitee@example.test", roleId: employee });
    const token = lastToken();
    // The org fills up some other way before the invitation is used.
    for (let i = 0; i < 4; i++) await addMember(org.id, "employee");
    const invitee = await createUser({ email: "invitee@example.test" });
    await expect(acceptInvitation(invitee, token)).rejects.toMatchObject(PLAN_LIMIT);
    // Nothing half-done: no membership, invitation still pending.
    expect((await db()`select count(*)::int as n from organization_member where user_id = ${invitee.id}`)[0].n).toBe(0);
    expect((await db()`select status from invitation where email = 'invitee@example.test'`)[0].status).toBe("pending");
  });

  it("custom roles need Indiana or above", async () => {
    const { org, ctx } = await createOrgWithOwner("roles", undefined, { license: "trial" });
    const role = { name: "Reviewer", permissions: ["organization.read"] };
    await expect(createCustomRole(ctx, role)).rejects.toMatchObject(PLAN_LIMIT);
    await setLicense(org.id, { plan: "indiana", status: "active" });
    await expect(createCustomRole(ctx, role)).resolves.toHaveProperty("id");
  });
});

describe("licenses: expiry makes the workspace read-only", () => {
  let employee: string;
  beforeEach(async () => {
    await resetDatabase();
    employee = await systemRoleId("employee");
  });

  it("an ended trial blocks changes but keeps data readable", async () => {
    const { org, ctx } = await createOrgWithOwner("ended", undefined, { license: "trial" });
    const { member: m } = await addMember(org.id, "employee");
    await setLicense(org.id, { plan: "medisea", status: "trialing", trialEndsAt: new Date(Date.now() - DAY) });
    expect((await getLicenseOverview(org.id)).license?.state).toBe("expired");

    await expect(createInvitation(ctx, { email: "x@example.test", roleId: employee })).rejects.toMatchObject(PLAN_LIMIT);
    await expect(updateOrganization(ctx, { name: "Renamed" })).rejects.toMatchObject(PLAN_LIMIT);
    await expect(listMembers(ctx)).resolves.toHaveLength(2);
    // Reducing usage is always allowed.
    await expect(removeMember(ctx, m.id)).resolves.toBeUndefined();
  });

  it("past due keeps access; canceled keeps access until the period ends; paused does not", async () => {
    const { org, ctx } = await createOrgWithOwner("states", undefined, { license: "trial" });
    const rename = (name: string) => updateOrganization(ctx, { name: `Renamed ${name}` });

    await setLicense(org.id, { plan: "indiana", status: "past_due" });
    await expect(rename("A")).resolves.toBeDefined();

    await setLicense(org.id, { plan: "indiana", status: "canceled", periodEndsAt: new Date(Date.now() + 5 * DAY) });
    expect((await getLicenseOverview(org.id)).license?.state).toBe("canceling");
    await expect(rename("B")).resolves.toBeDefined();

    await setLicense(org.id, { plan: "indiana", status: "canceled", periodEndsAt: new Date(Date.now() - DAY) });
    await expect(rename("C")).rejects.toMatchObject(PLAN_LIMIT);

    await setLicense(org.id, { plan: "indiana", status: "paused" });
    await expect(rename("D")).rejects.toMatchObject(PLAN_LIMIT);
  });

  it("one organization's license never affects another's (cross-tenant)", async () => {
    const owner = await createUser();
    const a = await createOrgWithOwner("tenant-a", owner, { license: "trial" });
    const b = await createOrgWithOwner("tenant-b", owner);
    await setLicense(a.org.id, { plan: "medisea", status: "trialing", trialEndsAt: new Date(Date.now() - DAY) });

    await expect(updateOrganization(a.ctx, { name: "A2" })).rejects.toMatchObject(PLAN_LIMIT);
    await expect(updateOrganization(b.ctx, { name: "B2" })).resolves.toBeDefined();
    await expect(createCustomRole(b.ctx, { name: "Ops", permissions: ["organization.read"] })).resolves.toHaveProperty("id");
  });
});
