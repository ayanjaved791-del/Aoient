import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { leaveDecisionSchema, leaveRequestSchema, workingDays } from "@/lib/validation/people";
import { getMyEmployeeId } from "./employees";

export type LeaveType = "annual" | "sick" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRow {
  id: string;
  employee: { id: string; name: string; jobTitle: string | null };
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  /** Only shown to the requester and to approvers. */
  reason: string | null;
  status: LeaveStatus;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
  isMine: boolean;
}

type Raw = {
  id: string; employee_id: string; full_name: string; job_title: string | null; member_id: string | null; type: LeaveType;
  start_date: string; end_date: string; days: string; reason: string | null; status: LeaveStatus; decided_by: string | null;
  decided_at: Date | null; decision_note: string | null; created_at: Date;
};

function toRow(ctx: OrgContext, r: Raw, approver: boolean): LeaveRow {
  const isMine = r.member_id !== null && r.member_id === ctx.memberId;
  return {
    id: r.id, employee: { id: r.employee_id, name: r.full_name, jobTitle: r.job_title }, type: r.type,
    startDate: r.start_date, endDate: r.end_date, days: Number(r.days),
    reason: isMine || approver ? r.reason : null,
    status: r.status, decidedBy: r.decided_by, decidedAt: r.decided_at, decisionNote: isMine || approver ? r.decision_note : null,
    createdAt: r.created_at, isMine,
  };
}

const SELECT = (db: ReturnType<typeof getDb>) => db`
  select l.id, l.employee_id, e.full_name, e.job_title, e.member_id, l.type, to_char(l.start_date, 'YYYY-MM-DD') as start_date,
         to_char(l.end_date, 'YYYY-MM-DD') as end_date, l.days::text, l.reason, l.status, nullif(p.name, '') as decided_by,
         l.decided_at, l.decision_note, l.created_at
  from leave_request l
  join employee e on e.id = l.employee_id and e.organization_id = l.organization_id
  left join profile p on p.id = l.decided_by_id`;

/** Requests leave for yourself. Needs people.leave.request and an employee record linked to your account. */
export async function requestLeave(ctx: OrgContext, input: unknown): Promise<{ id: string; days: number }> {
  assertPermission(ctx, "people.leave.request");
  const data = parseInput(leaveRequestSchema, input);
  const days = data.halfDay ? 0.5 : workingDays(data.startDate, data.endDate);
  if (days <= 0) throw new ValidationError("Those dates are only weekend days", { endDate: ["Pick at least one working day (Mon–Fri)"] });
  if (days > 60) throw new ValidationError("Leave requests are limited to 60 working days", { endDate: ["Split long leave into shorter requests"] });
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const employeeId = await getMyEmployeeId(ctx, tx);
    if (!employeeId) throw new ForbiddenError("Your account isn't linked to an employee record yet. Ask HR or an admin to link it in People.");
    const [active] = await tx`select 1 from employee where id = ${employeeId} and organization_id = ${ctx.organizationId} and status = 'active'`;
    if (!active) throw new ForbiddenError("Your employee record is archived, so you can't request leave.");
    const [overlap] = await tx`
      select 1 from leave_request where employee_id = ${employeeId} and status in ('pending', 'approved')
        and start_date <= ${data.endDate} and end_date >= ${data.startDate}`;
    if (overlap) throw new ConflictError("You already have leave requested or approved on some of those days.");
    const [row] = await tx<{ id: string }[]>`
      insert into leave_request (organization_id, employee_id, type, start_date, end_date, days, reason, requested_by_id)
      values (${ctx.organizationId}, ${employeeId}, ${data.type}, ${data.startDate}, ${data.endDate}, ${days}, ${data.reason}, ${ctx.userId})
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.leave_requested", targetType: "leave_request", targetId: row.id, metadata: { type: data.type, days } });
    return { id: row.id, days };
  });
}

/**
 * "mine": your own requests. "team": everyone's, for approvers
 * (people.leave.approve). Reasons are only shown to the requester and approvers.
 */
export async function listLeave(ctx: OrgContext, opts: { scope: "mine" | "team"; status?: LeaveStatus | "all" }): Promise<LeaveRow[]> {
  const approver = can(ctx, "people.leave.approve");
  if (opts.scope === "team") assertPermission(ctx, "people.leave.approve");
  const db = getDb();
  const employeeId = opts.scope === "mine" ? await getMyEmployeeId(ctx) : null;
  if (opts.scope === "mine" && !employeeId) return [];
  const status = opts.status ?? "all";
  const rows = await db<Raw[]>`
    ${SELECT(db)}
    where l.organization_id = ${ctx.organizationId}
      ${employeeId ? db`and l.employee_id = ${employeeId}` : db``}
      ${status === "all" ? db`` : db`and l.status = ${status}`}
    order by case l.status when 'pending' then 0 else 1 end, l.start_date desc
    limit 300`;
  return rows.map((r) => toRow(ctx, r, approver));
}

export async function decideLeave(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "people.leave.approve");
  if (!isUuid(id)) throw new NotFoundError("Leave request not found");
  const data = parseInput(leaveDecisionSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [req] = await tx<{ status: LeaveStatus; member_id: string | null; full_name: string }[]>`
      select l.status, e.member_id, e.full_name from leave_request l join employee e on e.id = l.employee_id
      where l.id = ${id} and l.organization_id = ${ctx.organizationId} for update of l`;
    if (!req) throw new NotFoundError("Leave request not found");
    if (req.member_id === ctx.memberId) throw new ForbiddenError("You can't approve or decline your own leave.");
    if (req.status !== "pending") throw new ConflictError(`This request was already ${req.status}.`);
    await tx`
      update leave_request set status = ${data.decision}, decided_by_id = ${ctx.userId}, decided_at = now(), decision_note = ${data.note}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId,
      action: data.decision === "approved" ? "people.leave_approved" : "people.leave_rejected",
      targetType: "leave_request", targetId: id, metadata: { name: req.full_name },
    });
  });
}

/** Cancel your own pending request (or an approved one that hasn't started). */
export async function cancelLeave(ctx: OrgContext, id: string): Promise<void> {
  if (!isUuid(id)) throw new NotFoundError("Leave request not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const employeeId = await getMyEmployeeId(ctx, tx);
    const [req] = await tx<{ status: LeaveStatus; started: boolean }[]>`
      select status, start_date <= (now() at time zone ${ctx.organization.timezone})::date as started from leave_request
      where id = ${id} and organization_id = ${ctx.organizationId} and employee_id = ${employeeId ?? "00000000-0000-0000-0000-000000000000"} for update`;
    if (!req) throw new NotFoundError("Leave request not found");
    if (!(req.status === "pending" || (req.status === "approved" && !req.started))) throw new ConflictError("Only upcoming leave can be cancelled.");
    await tx`update leave_request set status = 'cancelled', updated_at = now() where id = ${id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.leave_cancelled", targetType: "leave_request", targetId: id });
  });
}

/** Who is away on approved leave today (names and leave type only). */
export async function whoIsOut(ctx: OrgContext): Promise<{ id: string; name: string; type: LeaveType; until: string }[]> {
  assertPermission(ctx, "people.employee.read");
  return getDb()<{ id: string; name: string; type: LeaveType; until: string }[]>`
    select e.id, e.full_name as name, l.type, to_char(l.end_date, 'YYYY-MM-DD') as until
    from leave_request l join employee e on e.id = l.employee_id and e.organization_id = l.organization_id
    where l.organization_id = ${ctx.organizationId} and l.status = 'approved' and e.status = 'active'
      and (now() at time zone ${ctx.organization.timezone})::date between l.start_date and l.end_date
    order by lower(e.full_name)`;
}

/** One person's leave history: for approvers, or for the person themselves. */
export async function listLeaveForEmployee(ctx: OrgContext, employeeId: string): Promise<LeaveRow[] | null> {
  if (!isUuid(employeeId)) return null;
  const approver = can(ctx, "people.leave.approve");
  const mine = await getMyEmployeeId(ctx);
  if (!approver && mine !== employeeId) return null;
  const db = getDb();
  const rows = await db<Raw[]>`${SELECT(db)} where l.organization_id = ${ctx.organizationId} and l.employee_id = ${employeeId} order by l.start_date desc limit 50`;
  return rows.map((r) => toRow(ctx, r, approver));
}
