/**
 * Attendance: people check themselves in and out, HR sees the register and
 * corrects days, and no organization sees another's attendance.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase } from "../support/db";
import { createEmployee } from "@/server/people/employees";
import {
  checkIn, checkOut, clearAttendance, correctAttendance, getAttendanceSummary, getEmployeeAttendance, getMyToday, getRegister, getTodayCounts,
  listMyAttendance, saveAttendanceSetting,
} from "@/server/people/attendance";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function setup(slug: string) {
  const { org, ctx } = await createOrgWithOwner(slug);
  const hr = await addMember(org.id, "hr_manager");
  const worker = await addMember(org.id, "employee");
  const unlinked = await addMember(org.id, "employee");
  const emp = await createEmployee(ctx, { fullName: "Worker Wasi", memberId: worker.member.id });
  const other = await createEmployee(ctx, { fullName: "Aisha Absent" });
  return { org, ctx, hr, worker, unlinked, emp, other };
}

describe("attendance", () => {
  beforeEach(resetDatabase);

  it("checks in once, checks out once, and shows the day", async () => {
    const s = await setup("att-self");
    expect(await getMyToday(s.worker.ctx)).toMatchObject({ status: "none", checkIn: null });
    const inn = await checkIn(s.worker.ctx, {});
    expect(inn.at).toMatch(/^\d\d:\d\d$/);
    await expect(checkIn(s.worker.ctx, {})).rejects.toMatchObject({ code: "CONFLICT" });
    await db()`update attendance_record set check_in_at = now() - interval '8 hours 5 minutes' where id = ${inn.id}`;
    expect((await checkOut(s.worker.ctx, { note: "Left for a client" })).minutes).toBe(485);
    await expect(checkOut(s.worker.ctx, {})).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await getMyToday(s.worker.ctx)).toMatchObject({ status: "present", minutes: 485, note: "Left for a client" });
    expect((await listMyAttendance(s.worker.ctx, today().slice(0, 7)))[0]).toMatchObject({ workDate: today(), minutes: 485 });
    // Not linked to an employee record: told plainly, nothing saved.
    expect(await getMyToday(s.unlinked.ctx)).toBeNull();
    await expect(checkIn(s.unlinked.ctx, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("marks late check-ins against the workspace's start time", async () => {
    const s = await setup("att-late");
    await saveAttendanceSetting(s.hr.ctx, { workStarts: "09:00", graceMinutes: 10 });
    await correctAttendance(s.hr.ctx, { employeeId: s.emp.id, workDate: daysAgo(1), status: "present", checkIn: "09:25", checkOut: "17:00" });
    await correctAttendance(s.hr.ctx, { employeeId: s.other.id, workDate: daysAgo(1), status: "present", checkIn: "09:05" });
    const reg = await getRegister(s.hr.ctx, daysAgo(1));
    expect(Object.fromEntries(reg.map((d) => [d.employee.name, [d.late, d.minutes, d.corrected]]))).toEqual({ "Worker Wasi": [true, 455, true], "Aisha Absent": [false, null, true] });
    await expect(saveAttendanceSetting(s.hr.ctx, { workStarts: "25:00", graceMinutes: 0 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("lets HR correct, mark absent and clear days, and totals the month", async () => {
    const s = await setup("att-hr");
    await checkIn(s.worker.ctx, {});
    expect((await getTodayCounts(s.hr.ctx))).toMatchObject({ total: 2, in: 1 });
    const absent = await correctAttendance(s.hr.ctx, { employeeId: s.other.id, workDate: today(), status: "absent", checkIn: "09:00" });
    expect((await getRegister(s.hr.ctx, today())).find((d) => d.employee.id === s.other.id)).toMatchObject({ status: "absent", checkIn: null });
    await expect(correctAttendance(s.hr.ctx, { employeeId: s.emp.id, workDate: today(), status: "present", checkIn: "10:00", checkOut: "09:00" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(correctAttendance(s.hr.ctx, { employeeId: s.emp.id, workDate: "2999-01-01", status: "absent" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(correctAttendance(s.hr.ctx, { employeeId: s.emp.id, workDate: today(), status: "present" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const sum = await getAttendanceSummary(s.hr.ctx, today().slice(0, 7));
    expect(sum.rows.find((r) => r.employee.id === s.other.id)).toMatchObject({ absent: 1 });
    expect(sum.rows.find((r) => r.employee.id === s.emp.id)).toMatchObject({ present: 1 });
    await clearAttendance(s.hr.ctx, absent.id);
    expect((await getEmployeeAttendance(s.hr.ctx, s.other.id, today().slice(0, 7)))[0].status).toBe("none");
  });

  it("keeps the register to HR: employees only see and change their own day", async () => {
    const s = await setup("att-roles");
    await expect(getRegister(s.worker.ctx, today())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(correctAttendance(s.worker.ctx, { employeeId: s.emp.id, workDate: today(), status: "present", checkIn: "08:00" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getAttendanceSummary(s.worker.ctx, today().slice(0, 7))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveAttendanceSetting(s.worker.ctx, { workStarts: "06:00", graceMinutes: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const guest = await addMember(s.org.id, "guest");
    await expect(checkIn(guest.ctx, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never shows or changes another organization's attendance", async () => {
    const a = await setup("att-a");
    const b = await setup("att-b");
    const rec = await checkIn(b.worker.ctx, {});
    await expect(correctAttendance(a.hr.ctx, { employeeId: b.emp.id, workDate: today(), status: "absent" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(getEmployeeAttendance(a.hr.ctx, b.emp.id, today().slice(0, 7))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(clearAttendance(a.hr.ctx, rec.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getRegister(a.hr.ctx, today())).map((d) => d.employee.name).sort()).toEqual(["Aisha Absent", "Worker Wasi"]);
    expect((await getRegister(a.hr.ctx, today())).every((d) => d.checkIn === null)).toBe(true);
    expect((await getMyToday(b.worker.ctx))?.checkIn).not.toBeNull();
    // The database refuses a record pointing at another organization's employee.
    await expect(db()`insert into attendance_record (organization_id, employee_id, work_date) values (${a.org.id}, ${b.emp.id}, ${today()})`).rejects.toThrow();
  });
});
