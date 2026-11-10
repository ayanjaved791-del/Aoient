import "server-only";
import { getDb, transaction, type Db } from "@/server/database/client";
import { assertWritable } from "@/server/billing/license";
import { can, type OrgContext } from "@/server/tenancy/context";
import { projectFor } from "@/server/projects/shared";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { entrySchema, timerSchema, weekStartOf } from "@/lib/validation/time";
import { docNumber } from "@/server/finance/shared";

/**
 * Time entries. Everyone tracks their own time (`time.entry.own`); seeing
 * other people's needs `time.entry.read_all`. Nobody edits someone else's
 * entries. A week that's submitted or approved is locked, and hours already
 * put on an invoice can't change.
 */
export interface TimeEntryRow {
  id: string;
  member: { id: string; name: string };
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
  description: string | null;
  workDate: string;
  /** For a running timer: minutes so far. */
  minutes: number;
  running: boolean;
  startedAt: Date | null;
  billable: boolean;
  invoice: { id: string; number: string } | null;
  createdAt: Date;
}

export const tracksTime = (ctx: OrgContext) => can(ctx, "time.entry.own");
export const seesAllTime = (ctx: OrgContext) => can(ctx, "time.entry.read_all");

export function todayIn(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

type EntryDb = {
  id: string; member_id: string; member_name: string | null; project_id: string | null; project_name: string | null; task_id: string | null; task_title: string | null;
  description: string | null; work_date: string; minutes: number | null; started_at: Date | null; billable: boolean; invoice_id: string | null; invoice_number: number | null; created_at: Date; elapsed: number;
};
export const toEntry = (r: EntryDb): TimeEntryRow => ({
  id: r.id, member: { id: r.member_id, name: r.member_name ?? "Former member" },
  project: r.project_id ? { id: r.project_id, name: r.project_name! } : null, task: r.task_id ? { id: r.task_id, title: r.task_title! } : null,
  description: r.description, workDate: r.work_date, minutes: r.minutes ?? Math.max(0, r.elapsed), running: r.minutes === null, startedAt: r.started_at,
  billable: r.billable, invoice: r.invoice_id ? { id: r.invoice_id, number: docNumber("invoice", r.invoice_number!) } : null, createdAt: r.created_at,
});

export function entryQuery(sql: Db, organizationId: string, where: ReturnType<Db>) {
  return sql<EntryDb[]>`
    select e.id, e.member_id, pr.name as member_name, p.id as project_id, p.name as project_name, t.id as task_id, t.title as task_title,
      e.description, to_char(e.work_date, 'YYYY-MM-DD') as work_date, e.minutes, e.started_at, e.billable,
      d.id as invoice_id, d.number as invoice_number, e.created_at,
      coalesce(floor(extract(epoch from (now() - e.started_at)) / 60), 0)::int as elapsed
    from time_entry e
    join organization_member m on m.id = e.member_id and m.organization_id = e.organization_id
    left join profile pr on pr.id = m.user_id
    left join project p on p.id = e.project_id and p.organization_id = e.organization_id
    left join project_task t on t.id = e.task_id and t.organization_id = e.organization_id
    left join finance_document d on d.id = e.invoice_id and d.organization_id = e.organization_id
    where e.organization_id = ${organizationId} and ${where}
    order by e.work_date desc, e.created_at desc
    limit 2000`;
}

export async function listEntries(ctx: OrgContext, opts: { memberId?: string; projectId?: string; from: string; to: string }): Promise<TimeEntryRow[]> {
  if (!tracksTime(ctx) && !seesAllTime(ctx)) throw new ForbiddenError();
  const memberId = opts.memberId ?? ctx.memberId;
  if (memberId !== ctx.memberId && !seesAllTime(ctx)) throw new ForbiddenError("You can only see your own time.");
  if (!isUuid(memberId) || (opts.projectId && !isUuid(opts.projectId))) return [];
  const sql = getDb();
  const rows = await entryQuery(sql, ctx.organizationId, sql`e.member_id = ${memberId} and e.work_date between ${opts.from} and ${opts.to}
    ${opts.projectId ? sql`and e.project_id = ${opts.projectId}` : sql``}`);
  return rows.map(toEntry);
}

export async function getRunningTimer(ctx: OrgContext): Promise<TimeEntryRow | null> {
  if (!tracksTime(ctx)) return null;
  const sql = getDb();
  const [row] = await entryQuery(sql, ctx.organizationId, sql`e.member_id = ${ctx.memberId} and e.minutes is null`);
  return row ? toEntry(row) : null;
}

/** The project must be one this person can see; the task must be in that project. */
async function assertLinks(tx: Db, ctx: OrgContext, projectId: string | null, taskId: string | null) {
  if (taskId && !projectId) throw new ValidationError("Pick the project first", { taskId: ["Pick the project first"] });
  if (!projectId) return;
  if (!can(ctx, "projects.project.read")) throw new ValidationError("Pick a valid project", { projectId: ["Pick a valid project"] });
  try {
    await projectFor(tx, ctx, projectId);
  } catch (e) {
    if (e instanceof NotFoundError) throw new ValidationError("Pick a valid project", { projectId: ["Pick a valid project"] });
    throw e;
  }
  if (taskId) {
    if (!isUuid(taskId)) throw new ValidationError("Pick a valid task", { taskId: ["Pick a valid task"] });
    const [t] = await tx`select 1 from project_task where id = ${taskId} and project_id = ${projectId} and organization_id = ${ctx.organizationId}`;
    if (!t) throw new ValidationError("Pick a valid task", { taskId: ["Pick a valid task"] });
  }
}

/** Entries in a submitted or approved week can't change. */
export async function assertWeekOpen(tx: Db, ctx: OrgContext, memberId: string, day: string) {
  const [ts] = await tx<{ status: string }[]>`
    select status from time_timesheet where organization_id = ${ctx.organizationId} and member_id = ${memberId} and week_start = ${weekStartOf(day)}`;
  if (ts && ts.status !== "rejected") {
    throw new ConflictError(ts.status === "approved" ? "That week's timesheet is approved, so its time is locked." : "That week's timesheet is submitted. Withdraw it to make changes.");
  }
}

function requireOwn(ctx: OrgContext) {
  if (!tracksTime(ctx)) throw new ForbiddenError("Your role doesn't track time.");
}

async function lockOwnEntry(tx: Db, ctx: OrgContext, id: string) {
  if (!isUuid(id)) throw new NotFoundError("Time entry not found");
  const [e] = await tx<{ id: string; member_id: string; work_date: string; minutes: number | null; invoice_id: string | null }[]>`
    select id, member_id, to_char(work_date, 'YYYY-MM-DD') as work_date, minutes, invoice_id from time_entry
    where id = ${id} and organization_id = ${ctx.organizationId} for update`;
  // Someone else's entry reads as missing, whatever the role.
  if (!e || e.member_id !== ctx.memberId) throw new NotFoundError("Time entry not found");
  if (e.invoice_id) throw new ConflictError("These hours are on an invoice. Delete that draft invoice first to change them.");
  return e;
}

/** Stops the running timer inside a transaction; returns the saved minutes, or null if none ran. */
async function stopRunning(tx: Db, ctx: OrgContext): Promise<{ id: string; minutes: number } | null> {
  const [run] = await tx<{ id: string; elapsed: number }[]>`
    select id, round(extract(epoch from (clock_timestamp() - started_at)) / 60)::int as elapsed from time_entry
    where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and minutes is null for update`;
  if (!run) return null;
  const minutes = Math.min(1440, Math.max(1, run.elapsed));
  await tx`update time_entry set minutes = ${minutes}, updated_at = now() where id = ${run.id}`;
  return { id: run.id, minutes };
}

export async function startTimer(ctx: OrgContext, input: unknown): Promise<{ id: string; stopped: { id: string; minutes: number } | null }> {
  requireOwn(ctx);
  const t = parseInput(timerSchema, input);
  const day = todayIn(ctx.organization.timezone);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertLinks(tx, ctx, t.projectId, t.taskId);
    await assertWeekOpen(tx, ctx, ctx.memberId, day);
    // Starting a new timer stops the one that's running.
    const stopped = await stopRunning(tx, ctx);
    const [row] = await tx<{ id: string }[]>`
      insert into time_entry (organization_id, member_id, project_id, task_id, description, work_date, started_at, billable)
      values (${ctx.organizationId}, ${ctx.memberId}, ${t.projectId}, ${t.taskId}, ${t.description}, ${day}, now(), ${t.billable}) returning id`;
    return { id: row.id, stopped };
  });
}

export async function stopTimer(ctx: OrgContext): Promise<{ id: string; minutes: number }> {
  requireOwn(ctx);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const stopped = await stopRunning(tx, ctx);
    if (!stopped) throw new ConflictError("No timer is running.");
    return stopped;
  });
}

export async function discardTimer(ctx: OrgContext): Promise<void> {
  requireOwn(ctx);
  await transaction(async (tx) => {
    const r = await tx`delete from time_entry where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and minutes is null`;
    if (r.count === 0) throw new ConflictError("No timer is running.");
  });
}

export async function createEntry(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  requireOwn(ctx);
  const e = parseInput(entrySchema, input);
  if (e.workDate > todayIn(ctx.organization.timezone)) throw new ValidationError("Time can't be logged for a future day", { workDate: ["Can't be in the future"] });
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertLinks(tx, ctx, e.projectId, e.taskId);
    await assertWeekOpen(tx, ctx, ctx.memberId, e.workDate);
    const [{ total }] = await tx<{ total: number }[]>`
      select coalesce(sum(minutes), 0)::int as total from time_entry where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and work_date = ${e.workDate}`;
    if (total + e.duration > 1440) throw new ValidationError("That's more than 24 hours on one day", { duration: ["More than 24 hours that day"] });
    const [row] = await tx<{ id: string }[]>`
      insert into time_entry (organization_id, member_id, project_id, task_id, description, work_date, minutes, billable)
      values (${ctx.organizationId}, ${ctx.memberId}, ${e.projectId}, ${e.taskId}, ${e.description}, ${e.workDate}, ${e.duration}, ${e.billable}) returning id`;
    return row;
  });
}

export async function updateEntry(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  requireOwn(ctx);
  const e = parseInput(entrySchema, input);
  if (e.workDate > todayIn(ctx.organization.timezone)) throw new ValidationError("Time can't be logged for a future day", { workDate: ["Can't be in the future"] });
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const cur = await lockOwnEntry(tx, ctx, id);
    if (cur.minutes === null) throw new ConflictError("Stop the timer before editing it.");
    await assertWeekOpen(tx, ctx, ctx.memberId, cur.work_date);
    await assertWeekOpen(tx, ctx, ctx.memberId, e.workDate);
    await assertLinks(tx, ctx, e.projectId, e.taskId);
    const [{ total }] = await tx<{ total: number }[]>`
      select coalesce(sum(minutes), 0)::int as total from time_entry
      where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and work_date = ${e.workDate} and id <> ${cur.id}`;
    if (total + e.duration > 1440) throw new ValidationError("That's more than 24 hours on one day", { duration: ["More than 24 hours that day"] });
    await tx`update time_entry set work_date = ${e.workDate}, minutes = ${e.duration}, project_id = ${e.projectId}, task_id = ${e.taskId},
      description = ${e.description}, billable = ${e.billable}, updated_at = now() where id = ${cur.id}`;
  });
}

export async function deleteEntry(ctx: OrgContext, id: string): Promise<void> {
  requireOwn(ctx);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const cur = await lockOwnEntry(tx, ctx, id);
    await assertWeekOpen(tx, ctx, ctx.memberId, cur.work_date);
    await tx`delete from time_entry where id = ${cur.id}`;
  });
}

/** Projects and their open tasks this person can log time against. */
export async function listTrackableWork(ctx: OrgContext) {
  if (!can(ctx, "projects.project.read")) return [];
  const sql = getDb();
  const seesAll = can(ctx, "projects.project.update");
  const projects = await sql<{ id: string; name: string }[]>`
    select p.id, p.name from project p where p.organization_id = ${ctx.organizationId} and p.archived_at is null and p.status in ('planning', 'active', 'on_hold')
      ${seesAll ? sql`` : sql`and exists (select 1 from project_member pm where pm.project_id = p.id and pm.member_id = ${ctx.memberId})`}
    order by lower(p.name) limit 300`;
  if (projects.length === 0) return [];
  const tasks = await sql<{ id: string; title: string; project_id: string }[]>`
    select id, title, project_id from project_task where organization_id = ${ctx.organizationId} and project_id in ${sql(projects.map((p) => p.id))} and status <> 'done'
    order by (assignee_member_id = ${ctx.memberId}) desc nulls last, position limit 2000`;
  return projects.map((p) => ({ id: p.id, name: p.name, tasks: tasks.filter((t) => t.project_id === p.id).map((t) => ({ id: t.id, title: t.title })) }));
}
