/** Dashboard people insights: counted from one organization's records only, and only for roles that may read people. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase } from "../support/db";
import { ForbiddenError } from "@/lib/errors";
import { createEmployee } from "@/server/people/employees";
import { createDepartment } from "@/server/people/departments";
import { getPeopleInsights } from "@/server/dashboard/people-insights";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (days: number, years = 0) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + years);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

async function setup() {
  const a = await createOrgWithOwner("ins-a");
  const worker = await addMember(a.org.id, "employee");
  const guest = await addMember(a.org.id, "guest");
  const eng = await createDepartment(a.ctx, { name: "Engineering" });
  await createDepartment(a.ctx, { name: "Design" });
  const old = await createEmployee(a.ctx, { fullName: "Veteran Vina", departmentId: eng.id, location: "Karachi", startDate: shift(3, -2) });
  const fresh = await createEmployee(a.ctx, { fullName: "Newbie Nabeel", departmentId: eng.id, location: "Lahore", startDate: shift(-5), jobTitle: "Engineer" });
  await createEmployee(a.ctx, { fullName: "Floating Faiz", location: "Karachi", startDate: shift(-200) });
  // Approved leave for Vina covering today and tomorrow.
  await db()`insert into leave_request (organization_id, employee_id, type, start_date, end_date, days, status)
    values (${a.org.id}, ${old.id}, 'annual', ${shift(0)}, ${shift(1)}, 2, 'approved')`;
  // A pending request must not count.
  await db()`insert into leave_request (organization_id, employee_id, type, start_date, end_date, days, status)
    values (${a.org.id}, ${fresh.id}, 'sick', ${shift(0)}, ${shift(0)}, 1, 'pending')`;

  const b = await createOrgWithOwner("ins-b");
  const bDept = await createDepartment(b.ctx, { name: "Secret B Dept" });
  const bEmp = await createEmployee(b.ctx, { fullName: "Hidden Huma", departmentId: bDept.id, location: "Elsewhere", startDate: shift(2, -3) });
  await db()`insert into leave_request (organization_id, employee_id, type, start_date, end_date, days, status)
    values (${b.org.id}, ${bEmp.id}, 'annual', ${shift(0)}, ${shift(3)}, 4, 'approved')`;
  return { a, worker, guest, b };
}

describe("people insights", () => {
  beforeEach(resetDatabase);

  it("counts departments, places, tenure, leave and milestones from this organization only", async () => {
    const s = await setup();
    const ins = await getPeopleInsights(s.a.ctx);
    const text = JSON.stringify(ins);
    expect(text).not.toMatch(/Hidden Huma|Secret B Dept|Elsewhere/);

    expect(ins.departments).toEqual([
      expect.objectContaining({ name: "Engineering", count: 2 }),
      expect.objectContaining({ id: null, name: "No department", count: 1 }),
      expect.objectContaining({ name: "Design", count: 0 }),
    ]);
    expect(ins.locations).toEqual([{ name: "Karachi", count: 2 }, { name: "Lahore", count: 1 }]);
    expect(ins.tenure).toEqual([
      { label: "Under 3 months", count: 1 }, { label: "3–12 months", count: 1 }, { label: "1–2 years", count: 1 }, { label: "2+ years", count: 0 },
    ]);
    // Approved leave only; the other organization's leave is never counted.
    expect(ins.week.map((d) => d.out)).toEqual([1, 1, 0, 0, 0, 0, 0]);
    expect(ins.upcomingLeave.map((l) => l.name)).toEqual(["Veteran Vina"]);
    expect(ins.anniversaries).toEqual([expect.objectContaining({ name: "Veteran Vina", years: 2, inDays: 3 })]);
    expect(ins.newStarters.map((n) => n.name)).toEqual(["Newbie Nabeel"]);
    expect(ins.leaveDaysByType).toEqual([{ type: "annual", days: 2 }]);
  });

  it("gives employees the shared view without leave totals, and refuses roles that can't read people", async () => {
    const s = await setup();
    const ins = await getPeopleInsights(s.worker.ctx);
    expect(ins.departments.length).toBeGreaterThan(0);
    expect(ins.leaveDaysByType).toBeNull();
    await expect(getPeopleInsights(s.guest.ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("shows the other organization only its own people", async () => {
    const s = await setup();
    const b = await getPeopleInsights(s.b.ctx);
    expect(b.locations).toEqual([{ name: "Elsewhere", count: 1 }]);
    expect(JSON.stringify(b)).not.toMatch(/Veteran Vina|Newbie Nabeel|Engineering|Karachi/);
  });
});
