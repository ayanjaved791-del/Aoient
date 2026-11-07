/** People: directory, private details, departments and leave — scoped to one organization and by role. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase } from "../support/db";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { createEmployee, getEmployee, listEmployees, setEmployeeArchived, updateEmployee, getPeopleStats } from "@/server/people/employees";
import { createDepartment, deleteDepartment, listDepartments } from "@/server/people/departments";
import { cancelLeave, decideLeave, listLeave, requestLeave, whoIsOut } from "@/server/people/leave";
import { workingDays } from "@/lib/validation/people";

async function setup() {
  const a = await createOrgWithOwner("ppl-a");
  const hr = await addMember(a.org.id, "hr_manager");
  const worker = await addMember(a.org.id, "employee");
  const guest = await addMember(a.org.id, "guest");
  const eng = await createDepartment(a.ctx, { name: "Engineering" });
  const lead = await createEmployee(a.ctx, { fullName: "Lead Laila", workEmail: "laila@a.test", departmentId: eng.id, salaryAmount: 9000, salaryCurrency: "USD", salaryPeriod: "monthly" });
  const me = await createEmployee(hr.ctx, { fullName: "Worker Wasi", workEmail: "wasi@a.test", departmentId: eng.id, managerId: lead.id, memberId: worker.member.id, salaryAmount: 3000, salaryCurrency: "USD", salaryPeriod: "monthly", dateOfBirth: "1995-04-02" });
  const b = await createOrgWithOwner("ppl-b");
  const bDept = await createDepartment(b.ctx, { name: "Secret B Dept" });
  const bEmp = await createEmployee(b.ctx, { fullName: "Hidden Huma", departmentId: bDept.id });
  return { a, hr, worker, guest, eng, lead, me, b, bDept, bEmp };
}

describe("people", () => {
  beforeEach(resetDatabase);

  it("directory shows work details to employees; private details only to HR and to the person", async () => {
    const s = await setup();
    const list = await listEmployees(s.worker.ctx);
    expect(list.map((e) => e.fullName)).toEqual(["Lead Laila", "Worker Wasi"]);
    expect(JSON.stringify(list)).not.toMatch(/9000|3000|salary/i);

    const laila = await getEmployee(s.worker.ctx, s.lead.id);
    expect(laila.sensitive).toBeNull();
    expect(laila.reports.map((r) => r.name)).toEqual(["Worker Wasi"]);
    const mine = await getEmployee(s.worker.ctx, s.me.id);
    expect(mine).toMatchObject({ isSelf: true, sensitive: { salaryAmount: 3000, dateOfBirth: "1995-04-02" } });
    expect((await getEmployee(s.hr.ctx, s.lead.id)).sensitive).toMatchObject({ salaryAmount: 9000 });
  });

  it("only the right roles can add, edit, set private details and archive", async () => {
    const s = await setup();
    await expect(createEmployee(s.worker.ctx, { fullName: "Nope" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createEmployee(s.guest.ctx, { fullName: "Nope" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listEmployees(s.guest.ctx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setEmployeeArchived(s.worker.ctx, s.lead.id, true)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createDepartment(s.worker.ctx, { name: "Shadow" })).rejects.toBeInstanceOf(ForbiddenError);

    await updateEmployee(s.hr.ctx, s.lead.id, { fullName: "Lead Laila", workEmail: "laila@a.test", jobTitle: "Head of Engineering", departmentId: s.eng.id });
    expect((await getEmployee(s.a.ctx, s.lead.id)).jobTitle).toBe("Head of Engineering");
    // The audit entry lists changed fields, never private values.
    const [audit] = await db()<{ metadata: unknown }[]>`select metadata from audit_log where action = 'people.employee_updated' order by created_at desc limit 1`;
    expect(audit.metadata).toMatchObject({ fields: ["jobTitle"] });
    const created = await db()<{ metadata: unknown }[]>`select metadata from audit_log where action = 'people.employee_created'`;
    expect(JSON.stringify(created)).not.toMatch(/9000|3000|1995/);
  });

  it("never reads or links another organization's people or departments", async () => {
    const s = await setup();
    expect(JSON.stringify(await listEmployees(s.a.ctx, { status: "all" }))).not.toContain("Hidden Huma");
    expect((await listDepartments(s.a.ctx)).map((d) => d.name)).toEqual(["Engineering"]);
    await expect(getEmployee(s.a.ctx, s.bEmp.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateEmployee(s.a.ctx, s.bEmp.id, { fullName: "Hijack" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setEmployeeArchived(s.a.ctx, s.bEmp.id, true)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteDepartment(s.a.ctx, s.bDept.id)).rejects.toBeInstanceOf(NotFoundError);
    // Foreign ids in references are refused.
    await expect(createEmployee(s.a.ctx, { fullName: "X", departmentId: s.bDept.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(createEmployee(s.a.ctx, { fullName: "X", managerId: s.bEmp.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(createDepartment(s.a.ctx, { name: "Ops", headEmployeeId: s.bEmp.id })).rejects.toBeInstanceOf(NotFoundError);
    expect((await getEmployee(s.b.ctx, s.bEmp.id)).fullName).toBe("Hidden Huma");
  });

  it("prevents reporting loops and duplicate emails", async () => {
    const s = await setup();
    await expect(updateEmployee(s.a.ctx, s.lead.id, { fullName: "Lead Laila", managerId: s.me.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(createEmployee(s.a.ctx, { fullName: "Dup", workEmail: "LAILA@a.test" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("leave: request, approve, who's out, and the rules around it", async () => {
    const s = await setup();
    const today = new Date().toISOString().slice(0, 10);
    // Pick a Monday-Friday range that includes today when today is a weekday.
    const day = new Date().getUTCDay();
    const start = day === 0 || day === 6 ? new Date(Date.now() + ((8 - day) % 7) * 86_400_000).toISOString().slice(0, 10) : today;
    const req = await requestLeave(s.worker.ctx, { type: "annual", startDate: start, endDate: start, reason: "Family event" });
    expect(req.days).toBe(1);
    await expect(requestLeave(s.worker.ctx, { type: "sick", startDate: start, endDate: start })).rejects.toBeInstanceOf(ConflictError);
    // HR has no employee record linked: can't request.
    await expect(requestLeave(s.hr.ctx, { type: "annual", startDate: start, endDate: start })).rejects.toBeInstanceOf(ForbiddenError);

    // Employees can't see the team list or decide.
    await expect(listLeave(s.worker.ctx, { scope: "team" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(decideLeave(s.worker.ctx, req.id, { decision: "approved" })).rejects.toBeInstanceOf(ForbiddenError);
    // Another organization can't touch it.
    await expect(decideLeave(s.b.ctx, req.id, { decision: "approved" })).rejects.toBeInstanceOf(NotFoundError);

    const team = await listLeave(s.hr.ctx, { scope: "team", status: "pending" });
    expect(team).toHaveLength(1);
    expect(team[0].reason).toBe("Family event");
    await decideLeave(s.hr.ctx, req.id, { decision: "approved", note: "Enjoy" });
    await expect(decideLeave(s.hr.ctx, req.id, { decision: "rejected" })).rejects.toBeInstanceOf(ConflictError);
    const mine = await listLeave(s.worker.ctx, { scope: "mine" });
    expect(mine[0]).toMatchObject({ status: "approved", decisionNote: "Enjoy", isMine: true });

    if (start === today) {
      expect((await whoIsOut(s.worker.ctx)).map((w) => w.name)).toEqual(["Worker Wasi"]);
      expect((await getPeopleStats(s.a.ctx)).onLeaveToday).toBe(1);
      await expect(cancelLeave(s.worker.ctx, req.id)).rejects.toBeInstanceOf(ConflictError); // already started
    }
    // Someone else can't cancel your leave.
    await expect(cancelLeave(s.hr.ctx, req.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("counts working days and guards your own record", async () => {
    expect(workingDays("2026-11-06", "2026-11-09")).toBe(2); // Fri + Mon
    expect(workingDays("2026-11-07", "2026-11-08")).toBe(0); // weekend
    const s = await setup();
    const hrEmp = await createEmployee(s.a.ctx, { fullName: "HR Hamza", memberId: s.hr.member.id });
    await expect(setEmployeeArchived(s.hr.ctx, hrEmp.id, true)).rejects.toBeInstanceOf(ForbiddenError);
    await setEmployeeArchived(s.hr.ctx, s.lead.id, true);
    expect((await getEmployee(s.a.ctx, s.me.id)).manager).toBeNull(); // dropped from reporting line
  });
});
