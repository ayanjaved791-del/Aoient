import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { addDays, reviewTimesheetSchema, weekSchema } from "@/lib/validation/time";
import { entryQuery, seesAllTime, toEntry, tracksTime, type TimeEntryRow } from "./entries";

export type TimesheetStatus = "open" | "submitted" | "approved" | "rejected";
export interface WeekView {
  member: { id: string; name: string };
  weekStart: string;
  days: { date: string; minutes: number }[];
  entries: TimeEntryRow[];
  total: number;
  billable: number;
  status: TimesheetStatus;
  timesheet: { id: string; submittedAt: Date; reviewedBy: string | null; reviewedAt: Date | null; note: string | null } | null;
}

async function memberName(organizationId: string, memberId: string) {
  const [m] = await getDb()<{ name: string | null }[]>`
    select p.name from organization_member m left join profile p on p.id = m.user_id where m.id = ${memberId} and m.organization_id = ${organizationId}`;
  return m;
}

/** One person's week. Your own, or anyone's with `time.entry.read_all` or `time.timesheet.approve`. */
export async function getWeek(ctx: OrgContext, opts: { weekStart: string; memberId?: string }): Promise<WeekView> {
  const { weekStart } = parseInput(weekSchema, { weekStart: opts.weekStart });
  const memberId = opts.memberId ?? ctx.memberId;
  const other = memberId !== ctx.memberId;
  if (other ? !(seesAllTime(ctx) || can(ctx, "time.timesheet.approve")) : !tracksTime(ctx)) throw new ForbiddenError();
  if (!isUuid(memberId)) throw new NotFoundError("Person not found");
  const m = await memberName(ctx.organizationId, memberId);
  if (!m) throw new NotFoundError("Person not found");
  const sql = getDb();
  const end = addDays(weekStart, 6);
  const [rows, [ts]] = await Promise.all([
    entryQuery(sql, ctx.organizationId, sql`e.member_id = ${memberId} and e.work_date between ${weekStart} and ${end}`),
    sql<{ id: string; status: Exclude<TimesheetStatus, "open">; submitted_at: Date; reviewer: string | null; reviewed_at: Date | null; review_note: string | null }[]>`
      select t.id, t.status, t.submitted_at, rp.name as reviewer, t.reviewed_at, t.review_note
      from time_timesheet t
      left join organization_member rm on rm.id = t.reviewed_by_member_id and rm.organization_id = t.organization_id
      left join profile rp on rp.id = rm.user_id
      where t.organization_id = ${ctx.organizationId} and t.member_id = ${memberId} and t.week_start = ${weekStart}`,
  ]);
  const entries = rows.map(toEntry);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, minutes: entries.filter((e) => e.workDate === date).reduce((s, e) => s + e.minutes, 0) };
  });
  return {
    member: { id: memberId, name: m.name ?? "Former member" }, weekStart, days, entries,
    total: days.reduce((s, d) => s + d.minutes, 0), billable: entries.filter((e) => e.billable).reduce((s, e) => s + e.minutes, 0),
    status: ts?.status ?? "open",
    timesheet: ts ? { id: ts.id, submittedAt: ts.submitted_at, reviewedBy: ts.reviewer, reviewedAt: ts.reviewed_at, note: ts.review_note } : null,
  };
}

/** Sends your week for approval. It needs some time in it and no running timer. */
export async function submitWeek(ctx: OrgContext, input: unknown): Promise<void> {
  if (!tracksTime(ctx)) throw new ForbiddenError();
  const { weekStart } = parseInput(weekSchema, input);
  const end = addDays(weekStart, 6);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [stat] = await tx<{ n: number; running: number }[]>`
      select count(*)::int as n, (count(*) filter (where minutes is null))::int as running from time_entry
      where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and work_date between ${weekStart} and ${end}`;
    if (stat.n === 0) throw new ValidationError("There's no time in this week to submit.");
    if (stat.running > 0) throw new ConflictError("Stop the running timer first.");
    const [cur] = await tx<{ id: string; status: string }[]>`
      select id, status from time_timesheet where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and week_start = ${weekStart} for update`;
    if (cur && cur.status !== "rejected") throw new ConflictError(cur.status === "approved" ? "This week is already approved." : "This week is already submitted.");
    if (cur) {
      await tx`update time_timesheet set status = 'submitted', submitted_at = now(), reviewed_by_member_id = null, reviewed_at = null, review_note = null where id = ${cur.id}`;
    } else {
      await tx`insert into time_timesheet (organization_id, member_id, week_start) values (${ctx.organizationId}, ${ctx.memberId}, ${weekStart})`;
    }
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "time.timesheet_submitted", targetType: "time_timesheet", metadata: { week: weekStart } });
  });
}

/** Takes back a submitted (not yet approved) week so it can be edited. */
export async function withdrawWeek(ctx: OrgContext, input: unknown): Promise<void> {
  if (!tracksTime(ctx)) throw new ForbiddenError();
  const { weekStart } = parseInput(weekSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const r = await tx`delete from time_timesheet where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and week_start = ${weekStart} and status = 'submitted'`;
    if (r.count === 0) throw new ConflictError("Only a submitted week that isn't approved yet can be withdrawn.");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "time.timesheet_withdrawn", targetType: "time_timesheet", metadata: { week: weekStart } });
  });
}

export interface TimesheetRow { id: string; member: { id: string; name: string }; weekStart: string; status: Exclude<TimesheetStatus, "open">; total: number; billable: number; submittedAt: Date; reviewedBy: string | null; note: string | null; canReview: boolean }

export async function listTimesheets(ctx: OrgContext, opts: { status?: "submitted" | "approved" | "rejected" } = {}): Promise<TimesheetRow[]> {
  assertPermission(ctx, "time.timesheet.approve");
  const rows = await getDb()<{ id: string; member_id: string; name: string | null; week_start: string; status: TimesheetRow["status"]; total: number; billable: number; submitted_at: Date; reviewer: string | null; review_note: string | null }[]>`
    select t.id, t.member_id, p.name, to_char(t.week_start, 'YYYY-MM-DD') as week_start, t.status, t.submitted_at, rp.name as reviewer, t.review_note,
      coalesce((select sum(e.minutes) from time_entry e where e.organization_id = t.organization_id and e.member_id = t.member_id and e.work_date between t.week_start and t.week_start + 6), 0)::int as total,
      coalesce((select sum(e.minutes) from time_entry e where e.organization_id = t.organization_id and e.member_id = t.member_id and e.billable and e.work_date between t.week_start and t.week_start + 6), 0)::int as billable
    from time_timesheet t
    join organization_member m on m.id = t.member_id and m.organization_id = t.organization_id
    left join profile p on p.id = m.user_id
    left join organization_member rm on rm.id = t.reviewed_by_member_id and rm.organization_id = t.organization_id
    left join profile rp on rp.id = rm.user_id
    where t.organization_id = ${ctx.organizationId} ${opts.status ? getDb()`and t.status = ${opts.status}` : getDb()``}
    order by (t.status = 'submitted') desc, t.week_start desc, lower(p.name)
    limit 500`;
  return rows.map((r) => ({
    id: r.id, member: { id: r.member_id, name: r.name ?? "Former member" }, weekStart: r.week_start, status: r.status, total: r.total, billable: r.billable,
    submittedAt: r.submitted_at, reviewedBy: r.reviewer, note: r.review_note, canReview: r.status === "submitted" && (r.member_id !== ctx.memberId || ctx.isOwner),
  }));
}

/** Approve or send back a submitted week. Nobody approves their own, except the owner. */
export async function reviewTimesheet(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "time.timesheet.approve");
  const r = parseInput(reviewTimesheetSchema, input);
  if (!isUuid(id)) throw new NotFoundError("Timesheet not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [ts] = await tx<{ id: string; member_id: string; status: string; week_start: string; name: string | null }[]>`
      select t.id, t.member_id, t.status, to_char(t.week_start, 'YYYY-MM-DD') as week_start, p.name
      from time_timesheet t join organization_member m on m.id = t.member_id left join profile p on p.id = m.user_id
      where t.id = ${id} and t.organization_id = ${ctx.organizationId} for update of t`;
    if (!ts) throw new NotFoundError("Timesheet not found");
    if (ts.status !== "submitted") throw new ConflictError("This timesheet has already been reviewed.");
    if (ts.member_id === ctx.memberId && !ctx.isOwner) throw new ForbiddenError("Someone else has to approve your own timesheet.");
    await tx`update time_timesheet set status = ${r.decision === "approve" ? "approved" : "rejected"}, reviewed_by_member_id = ${ctx.memberId},
      reviewed_at = now(), review_note = ${r.note} where id = ${ts.id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: r.decision === "approve" ? "time.timesheet_approved" : "time.timesheet_rejected",
      targetType: "time_timesheet", targetId: ts.id, metadata: { name: ts.name, week: ts.week_start, note: r.note } });
  });
}
