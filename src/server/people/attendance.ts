import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { attendanceSettingSchema, checkSchema, correctionSchema, daySchema, monthRange, weekdaysBetween, type AttendanceStatus } from "@/lib/validation/attendance";
import { getMyEmployeeId } from "./employees";

/**
 * Attendance: people check in and out for themselves (people.attendance.own),
 * and HR sees the whole register and corrects days (people.attendance.manage).
 * Days are counted in the workspace's time zone. A record always belongs to an
 * employee in the same organization (enforced by a composite foreign key).
 */

export interface AttendanceDay {
  id: string | null;
  employee: { id: string; name: string; jobTitle: string | null; department: string | null };
  workDate: string;
  /** "leave" when approved leave covers the day and nothing was recorded; "none" when nothing at all. */
  status: AttendanceStatus | "leave" | "none";
  checkIn: string | null;
  checkOut: string | null;
  minutes: number | null;
  late: boolean;
  note: string | null;
  corrected: boolean;
}

export interface AttendanceSetting { workStarts: string; graceMinutes: number }

const tzOf = (ctx: OrgContext) => ctx.organization.timezone;
export const todayFor = (ctx: OrgContext) => new Intl.DateTimeFormat("en-CA", { timeZone: tzOf(ctx) }).format(new Date());

export async function getAttendanceSetting(ctx: OrgContext): Promise<AttendanceSetting> {
  const [row] = await getDb()<{ work_starts: string; grace_minutes: number }[]>`
    select to_char(work_starts, 'HH24:MI') as work_starts, grace_minutes from attendance_setting where organization_id = ${ctx.organizationId}`;
  return row ? { workStarts: row.work_starts, graceMinutes: row.grace_minutes } : { workStarts: "09:00", graceMinutes: 15 };
}

export async function saveAttendanceSetting(ctx: OrgContext, input: unknown): Promise<void> {
  assertPermission(ctx, "people.attendance.manage");
  const v = parseInput(attendanceSettingSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await tx`
      insert into attendance_setting (organization_id, work_starts, grace_minutes) values (${ctx.organizationId}, ${v.workStarts}, ${v.graceMinutes})
      on conflict (organization_id) do update set work_starts = excluded.work_starts, grace_minutes = excluded.grace_minutes, updated_at = now()`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.attendance_settings_updated", targetType: "organization", targetId: ctx.organizationId, metadata: v });
  });
}

type DayDb = {
  id: string | null; employee_id: string; full_name: string; job_title: string | null; department: string | null; work_date: string;
  status: AttendanceStatus | null; check_in: string | null; check_out: string | null; minutes: number | null; late: boolean | null;
  note: string | null; source: string | null; on_leave: boolean;
};
const toDay = (r: DayDb): AttendanceDay => ({
  id: r.id, employee: { id: r.employee_id, name: r.full_name, jobTitle: r.job_title, department: r.department }, workDate: r.work_date,
  status: r.status ?? (r.on_leave ? "leave" : "none"), checkIn: r.check_in, checkOut: r.check_out, minutes: r.minutes, late: Boolean(r.late),
  note: r.note, corrected: r.source === "manager",
});

/** Shared select: one row per (employee, day) with the record, lateness and approved leave. */
async function selectDays(ctx: OrgContext, opts: { employeeId?: string; from: string; to: string; registerOnly?: boolean }): Promise<AttendanceDay[]> {
  const sql = getDb();
  const tz = tzOf(ctx);
  const s = await getAttendanceSetting(ctx);
  const rows = await sql<DayDb[]>`
    with days as (select d::date as day from generate_series(${opts.from}::date, ${opts.to}::date, interval '1 day') d),
    people as (
      select e.id, e.full_name, e.job_title, dep.name as department from employee e left join department dep on dep.id = e.department_id
      where e.organization_id = ${ctx.organizationId} ${opts.employeeId ? sql`and e.id = ${opts.employeeId}` : sql`and e.status = 'active'`}
    )
    select a.id, p.id as employee_id, p.full_name, p.job_title, p.department, to_char(days.day, 'YYYY-MM-DD') as work_date, a.status,
      to_char(a.check_in_at at time zone ${tz}, 'HH24:MI') as check_in, to_char(a.check_out_at at time zone ${tz}, 'HH24:MI') as check_out,
      case when a.check_out_at is not null then round(extract(epoch from a.check_out_at - a.check_in_at) / 60)::int end as minutes,
      (a.check_in_at at time zone ${tz})::time > (${s.workStarts}::time + make_interval(mins => ${s.graceMinutes})) as late,
      a.note, a.source,
      exists (select 1 from leave_request l where l.employee_id = p.id and l.status = 'approved' and days.day between l.start_date and l.end_date) as on_leave
    from people p cross join days
    left join attendance_record a on a.organization_id = ${ctx.organizationId} and a.employee_id = p.id and a.work_date = days.day
    order by days.day desc, lower(p.full_name)`;
  return rows.map(toDay);
}

/** Your own check-in state for today, or null when your account isn't linked to an employee record. */
export async function getMyToday(ctx: OrgContext): Promise<AttendanceDay | null> {
  assertPermission(ctx, "people.attendance.own");
  const employeeId = await getMyEmployeeId(ctx);
  if (!employeeId) return null;
  const today = todayFor(ctx);
  return (await selectDays(ctx, { employeeId, from: today, to: today }))[0] ?? null;
}

async function myActiveEmployee(ctx: OrgContext, tx: Parameters<Parameters<typeof transaction>[0]>[0]) {
  const employeeId = await getMyEmployeeId(ctx, tx);
  if (!employeeId) throw new ForbiddenError("Your account isn't linked to an employee record yet. Ask HR or an admin to link it in People.");
  const [active] = await tx`select 1 from employee where id = ${employeeId} and organization_id = ${ctx.organizationId} and status = 'active'`;
  if (!active) throw new ForbiddenError("Your employee record is archived.");
  return employeeId;
}

export async function checkIn(ctx: OrgContext, input: unknown = {}): Promise<{ id: string; at: string }> {
  assertPermission(ctx, "people.attendance.own");
  const v = parseInput(checkSchema, input);
  const today = todayFor(ctx);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const employeeId = await myActiveEmployee(ctx, tx);
    const [row] = await tx<{ id: string; at: string }[]>`
      insert into attendance_record (organization_id, employee_id, work_date, status, check_in_at, note)
      values (${ctx.organizationId}, ${employeeId}, ${today}, 'present', now(), ${v.note})
      on conflict (organization_id, employee_id, work_date) do nothing
      returning id, to_char(check_in_at at time zone ${tzOf(ctx)}, 'HH24:MI') as at`;
    if (!row) throw new ConflictError("You've already checked in today.");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.checked_in", targetType: "attendance_record", targetId: row.id, metadata: { date: today } });
    return row;
  });
}

export async function checkOut(ctx: OrgContext, input: unknown = {}): Promise<{ id: string; at: string; minutes: number }> {
  assertPermission(ctx, "people.attendance.own");
  const v = parseInput(checkSchema, input);
  const today = todayFor(ctx);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const employeeId = await myActiveEmployee(ctx, tx);
    const [row] = await tx<{ id: string; at: string; minutes: number }[]>`
      update attendance_record set check_out_at = greatest(now(), check_in_at + interval '1 minute'), note = coalesce(${v.note}, note), updated_at = now()
      where organization_id = ${ctx.organizationId} and employee_id = ${employeeId} and work_date = ${today}
        and check_in_at is not null and check_out_at is null
      returning id, to_char(check_out_at at time zone ${tzOf(ctx)}, 'HH24:MI') as at, round(extract(epoch from check_out_at - check_in_at) / 60)::int as minutes`;
    if (!row) throw new ConflictError("Check in first. If you already checked out, ask HR to correct the day.");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.checked_out", targetType: "attendance_record", targetId: row.id, metadata: { date: today, minutes: row.minutes } });
    return row;
  });
}

/** Your own days in a month. */
export async function listMyAttendance(ctx: OrgContext, month: string): Promise<AttendanceDay[]> {
  assertPermission(ctx, "people.attendance.own");
  const range = monthRange(month);
  if (!range) throw new ValidationError("Pick a valid month");
  const employeeId = await getMyEmployeeId(ctx);
  if (!employeeId) return [];
  const today = todayFor(ctx);
  return selectDays(ctx, { employeeId, from: range.from, to: range.to < today ? range.to : today < range.from ? range.from : today });
}

/** Everyone's day: the register HR works from. */
export async function getRegister(ctx: OrgContext, date: string): Promise<AttendanceDay[]> {
  assertPermission(ctx, "people.attendance.manage");
  const d = parseInput(daySchema, date);
  return selectDays(ctx, { from: d, to: d });
}

/** One employee's month (HR view). */
export async function getEmployeeAttendance(ctx: OrgContext, employeeId: string, month: string): Promise<AttendanceDay[]> {
  assertPermission(ctx, "people.attendance.manage");
  const range = monthRange(month);
  if (!range) throw new ValidationError("Pick a valid month");
  if (!isUuid(employeeId)) throw new NotFoundError("Employee not found");
  const [e] = await getDb()`select 1 from employee where id = ${employeeId} and organization_id = ${ctx.organizationId}`;
  if (!e) throw new NotFoundError("Employee not found");
  return selectDays(ctx, { employeeId, from: range.from, to: range.to });
}

/** HR sets what happened on a day: times, half day or absent. */
export async function correctAttendance(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "people.attendance.manage");
  const v = parseInput(correctionSchema, input);
  if (v.workDate > todayFor(ctx)) throw new ValidationError("Attendance can't be set for a future day", { workDate: ["Can't be in the future"] });
  const msg = "Pick a valid person";
  if (!isUuid(v.employeeId)) throw new ValidationError(msg, { employeeId: [msg] });
  const tz = tzOf(ctx);
  const at = (t: string | null) => (t === null ? null : `${v.workDate} ${t}`);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [emp] = await tx<{ full_name: string }[]>`select full_name from employee where id = ${v.employeeId} and organization_id = ${ctx.organizationId}`;
    if (!emp) throw new ValidationError(msg, { employeeId: [msg] });
    const checkIn = v.status === "absent" ? null : at(v.checkIn);
    const checkOut = v.status === "absent" ? null : at(v.checkOut);
    const [row] = await tx<{ id: string }[]>`
      insert into attendance_record (organization_id, employee_id, work_date, status, check_in_at, check_out_at, note, source, corrected_by_id, corrected_at)
      values (${ctx.organizationId}, ${v.employeeId}, ${v.workDate}, ${v.status},
        ${checkIn}::timestamp at time zone ${tz}, ${checkOut}::timestamp at time zone ${tz}, ${v.note}, 'manager', ${ctx.userId}, now())
      on conflict (organization_id, employee_id, work_date) do update set status = excluded.status, check_in_at = excluded.check_in_at,
        check_out_at = excluded.check_out_at, note = excluded.note, source = 'manager', corrected_by_id = excluded.corrected_by_id, corrected_at = now(), updated_at = now()
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.attendance_corrected", targetType: "attendance_record", targetId: row.id, metadata: { name: emp.full_name, date: v.workDate, status: v.status } });
    return row;
  });
}

/** Removes a day's record entirely (HR). */
export async function clearAttendance(ctx: OrgContext, id: string): Promise<void> {
  assertPermission(ctx, "people.attendance.manage");
  if (!isUuid(id)) throw new NotFoundError("Record not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ full_name: string; work_date: string }[]>`
      delete from attendance_record a using employee e
      where a.id = ${id} and a.organization_id = ${ctx.organizationId} and e.id = a.employee_id
      returning e.full_name, to_char(a.work_date, 'YYYY-MM-DD') as work_date`;
    if (!row) throw new NotFoundError("Record not found");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.attendance_cleared", targetType: "attendance_record", targetId: id, metadata: { name: row.full_name, date: row.work_date } });
  });
}

export interface AttendanceSummaryRow {
  employee: { id: string; name: string; jobTitle: string | null };
  present: number; halfDays: number; absent: number; late: number; leave: number; unrecorded: number; minutes: number;
}

/** Month totals per active employee. Working days are Mon–Fri up to today. */
export async function getAttendanceSummary(ctx: OrgContext, month: string): Promise<{ workingDays: number; rows: AttendanceSummaryRow[] }> {
  assertPermission(ctx, "people.attendance.manage");
  const range = monthRange(month);
  if (!range) throw new ValidationError("Pick a valid month");
  const today = todayFor(ctx);
  if (range.from > today) return { workingDays: 0, rows: [] };
  const to = range.to < today ? range.to : today;
  const days = await selectDays(ctx, { from: range.from, to });
  const map = new Map<string, AttendanceSummaryRow>();
  for (const d of days) {
    const r = map.get(d.employee.id) ?? { employee: { id: d.employee.id, name: d.employee.name, jobTitle: d.employee.jobTitle }, present: 0, halfDays: 0, absent: 0, late: 0, leave: 0, unrecorded: 0, minutes: 0 };
    const w = new Date(`${d.workDate}T00:00:00Z`).getUTCDay();
    const weekday = w !== 0 && w !== 6;
    if (d.status === "present") r.present++;
    else if (d.status === "half_day") r.halfDays++;
    else if (d.status === "absent") r.absent++;
    else if (d.status === "leave" && weekday) r.leave++;
    else if (d.status === "none" && weekday && d.workDate < today) r.unrecorded++;
    if (d.late) r.late++;
    r.minutes += d.minutes ?? 0;
    map.set(d.employee.id, r);
  }
  return { workingDays: weekdaysBetween(range.from, to), rows: [...map.values()].sort((a, b) => a.employee.name.localeCompare(b.employee.name)) };
}

/** Today's headline numbers for HR. */
export async function getTodayCounts(ctx: OrgContext): Promise<{ total: number; in: number; out: number; late: number; leave: number; absent: number }> {
  if (!can(ctx, "people.attendance.manage")) throw new ForbiddenError();
  const days = await getRegister(ctx, todayFor(ctx));
  return {
    total: days.length,
    in: days.filter((d) => d.checkIn && !d.checkOut).length,
    out: days.filter((d) => d.checkOut).length,
    late: days.filter((d) => d.late).length,
    leave: days.filter((d) => d.status === "leave").length,
    absent: days.filter((d) => d.status === "absent").length,
  };
}
