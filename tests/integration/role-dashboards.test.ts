/** Each role sees its own dashboard: employees get only their own data; custom roles follow their permissions. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, resetDatabase } from "../support/db";
import { getDashboard } from "@/server/dashboard/dashboard";
import { getPersonalDashboard } from "@/server/dashboard/personal";
import { listMembers } from "@/server/organizations/organizations";
import { listPendingInvitations } from "@/server/organizations/invitations";
import { createCustomRole } from "@/server/organizations/roles";
import { createEmployee } from "@/server/people/employees";
import { decideLeave, requestLeave } from "@/server/people/leave";
import { ForbiddenError } from "@/lib/errors";

/** A weekday at least `ahead` days from now (YYYY-MM-DD). */
function weekday(ahead: number): string {
  const d = new Date(Date.now() + ahead * 86_400_000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function setup() {
  const a = await createOrgWithOwner("rd-a");
  const hr = await addMember(a.org.id, "hr_manager");
  const worker = await addMember(a.org.id, "employee");
  const other = await addMember(a.org.id, "employee");
  const me = await createEmployee(a.ctx, { fullName: "Worker Wasi", jobTitle: "Designer", memberId: worker.member.id });
  await createEmployee(a.ctx, { fullName: "Other Omar", memberId: other.member.id });
  const b = await createOrgWithOwner("rd-b");
  const bWorker = await addMember(b.org.id, "employee");
  await createEmployee(b.ctx, { fullName: "Hidden Huma", memberId: bWorker.member.id });
  return { a, hr, worker, other, me, b, bWorker };
}

describe("role-based dashboards", () => {
  beforeEach(resetDatabase);

  it("employees don't get team, invitation or audit data", async () => {
    const s = await setup();
    expect(s.worker.ctx.permissions.has("organization.members.read")).toBe(false);
    await expect(listMembers(s.worker.ctx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listPendingInvitations(s.worker.ctx)).rejects.toBeInstanceOf(ForbiddenError);
    const d = await getDashboard(s.worker.ctx, 30);
    expect(d.team).toBeNull();
    expect(d.activity).toBeNull();
    // Owners and HR still see the team.
    expect((await getDashboard(s.a.ctx, 30)).team).not.toBeNull();
    expect((await getDashboard(s.hr.ctx, 30)).team).not.toBeNull();
  });

  it("the personal dashboard holds only the viewer's own profile and leave", async () => {
    const s = await setup();
    const day = weekday(14);
    const mine = await requestLeave(s.worker.ctx, { type: "annual", startDate: day, endDate: day });
    await decideLeave(s.hr.ctx, mine.id, { decision: "approved" });
    const later = weekday(30);
    await requestLeave(s.worker.ctx, { type: "sick", startDate: later, endDate: later });
    await requestLeave(s.other.ctx, { type: "annual", startDate: day, endDate: day });
    await requestLeave(s.bWorker.ctx, { type: "annual", startDate: day, endDate: day });

    const p = await getPersonalDashboard(s.worker.ctx);
    expect(p.me).toMatchObject({ id: s.me.id, fullName: "Worker Wasi", jobTitle: "Designer" });
    expect(p.leave.canRequest).toBe(true);
    expect(p.leave.pending).toHaveLength(1);
    expect(p.leave.upcoming.map((l) => l.id)).toEqual([mine.id]);
    const names = new Set([...p.leave.pending, ...p.leave.upcoming].map((l) => l.employee.name));
    expect([...names]).toEqual(["Worker Wasi"]);
    expect(JSON.stringify(p)).not.toMatch(/Other Omar|Hidden Huma/);
  });

  it("a custom role sees exactly what its permissions allow", async () => {
    const s = await setup();
    const viewer = await createCustomRole(s.a.ctx, { name: "Front desk", permissions: ["organization.read"] });
    const desk = await addMember(s.a.org.id, viewer.id);
    expect((await getDashboard(desk.ctx, 30)).team).toBeNull();
    const p = await getPersonalDashboard(desk.ctx);
    expect(p.me).toBeNull();
    expect(p.leave.canRequest).toBe(false);

    const lead = await createCustomRole(s.a.ctx, { name: "Team lead", permissions: ["organization.read", "organization.members.read", "people.leave.request"] });
    const tl = await addMember(s.a.org.id, lead.id);
    expect((await getDashboard(tl.ctx, 30)).team).not.toBeNull();
    // No People record linked yet, so nothing to request leave against.
    expect((await getPersonalDashboard(tl.ctx)).leave.canRequest).toBe(false);
  });
});
