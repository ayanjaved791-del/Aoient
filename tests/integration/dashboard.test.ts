/** Dashboard numbers come from the caller's organization only, gated by role. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase, systemRoleId } from "../support/db";
import { getDashboard, parseRange } from "@/server/dashboard/dashboard";
import { createInvitation, revokeInvitation } from "@/server/organizations/invitations";

describe("dashboard", () => {
  beforeEach(resetDatabase);

  it("counts members, roles, invitations and daily series from real records", async () => {
    const a = await createOrgWithOwner("dash-a");
    const old = await addMember(a.org.id, "employee");
    await db()`update organization_member set joined_at = now() - interval '40 days' where id = ${old.member.id}`;
    await addMember(a.org.id, "employee");
    const inv = await createInvitation(a.ctx, { email: "p1@example.test", roleId: await systemRoleId("employee") });
    await createInvitation(a.ctx, { email: "p2@example.test", roleId: await systemRoleId("employee") });
    await revokeInvitation(a.ctx, inv.id);

    const d = await getDashboard(a.ctx, 30);
    expect(d.team).toMatchObject({ activeMembers: 3, joinedInRange: 2 });
    expect(d.team!.roles).toEqual([{ name: "Employee", count: 2 }, { name: "Owner", count: 1 }]);
    expect(d.team!.invitations).toMatchObject({ pending: 1, sent: 2, accepted: 0, revoked: 1, expired: 0 });
    expect(d.team!.teamByDay).toHaveLength(30);
    expect(d.team!.teamByDay[0].value).toBe(1); // only the member who joined 40 days ago
    expect(d.team!.teamByDay.at(-1)!.value).toBe(3);
    expect(d.activity!.byDay).toHaveLength(30);
    expect(d.activity!.total).toBe(4); // created + 2 invites + revoke
    expect(d.activity!.byDay.reduce((s, x) => s + x.value, 0)).toBe(4);
    expect(d.activity!.heatmap.flat().reduce((s, x) => s + x, 0)).toBe(4);
    expect(d.activity!.byArea).toEqual([
      { area: "Team", count: 3 }, { area: "People", count: 0 }, { area: "Sales", count: 0 }, { area: "Projects", count: 0 }, { area: "Roles & access", count: 0 }, { area: "Organization", count: 1 }, { area: "Billing", count: 0 },
    ]);
    expect(d.activity!.topPeople).toEqual([{ name: a.user.name, count: 4 }]);
    expect(d.team).toMatchObject({ adminMembers: 1, suspendedMembers: 0, joinedPrevRange: 1, sentPrevRange: 0, medianAcceptHours: null });
    expect(d.team!.recentlyJoined).toHaveLength(3);
    expect(d.team!.expiringInvites).toEqual([]);
  });

  it("never mixes in another organization's data", async () => {
    const a = await createOrgWithOwner("dash-a");
    const b = await createOrgWithOwner("dash-b");
    for (let i = 0; i < 3; i++) await addMember(b.org.id, "admin");
    await createInvitation(b.ctx, { email: "b@example.test", roleId: await systemRoleId("employee") });

    const d = await getDashboard(a.ctx, 90);
    expect(d.team).toMatchObject({ activeMembers: 1, roles: [{ name: "Owner", count: 1 }] });
    expect(d.team!.invitations).toMatchObject({ pending: 0, sent: 0 });
    expect(d.activity!.total).toBe(1); // A's "organization created" only
    expect(d.activity!.topPeople.map((p) => p.name)).toEqual([a.user.name]);
    expect(d.team!.recentlyJoined.map((m) => m.email)).toEqual([a.user.email]);
  });

  it("hides blocks the member's role can't see", async () => {
    const a = await createOrgWithOwner("dash-a");
    const employee = await addMember(a.org.id, "employee");
    const d = await getDashboard(employee.ctx, 7);
    expect(d.activity).toBeNull();
    expect(d.team === null).toBe(!employee.ctx.permissions.has("organization.members.read"));
  });

  it("accepts only the offered ranges", () => {
    expect([parseRange("7"), parseRange("90"), parseRange("365"), parseRange(undefined), parseRange("x")]).toEqual([7, 90, 30, 30, 30]);
  });
});
