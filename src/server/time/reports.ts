import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { createDocument } from "@/server/finance/documents";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { billHoursSchema, formatMinutes } from "@/lib/validation/time";

/** Team time for a date range, from recorded entries only (running timers aren't counted yet). */
export interface TimeReport {
  total: number;
  billable: number;
  people: { memberId: string; name: string; minutes: number; billable: number }[];
  projects: { projectId: string | null; name: string; minutes: number; billable: number; unbilled: number; company: string | null }[];
  days: { date: string; minutes: number }[];
  pendingTimesheets: number;
}

export async function getTimeReport(ctx: OrgContext, opts: { from: string; to: string }): Promise<TimeReport> {
  assertPermission(ctx, "time.entry.read_all");
  const sql = getDb();
  const org = ctx.organizationId;
  const [people, projects, days, [pending]] = await Promise.all([
    sql<{ member_id: string; name: string | null; minutes: number; billable: number }[]>`
      select e.member_id, p.name, sum(e.minutes)::int as minutes, coalesce(sum(e.minutes) filter (where e.billable), 0)::int as billable
      from time_entry e join organization_member m on m.id = e.member_id left join profile p on p.id = m.user_id
      where e.organization_id = ${org} and e.minutes is not null and e.work_date between ${opts.from} and ${opts.to}
      group by e.member_id, p.name order by 3 desc`,
    sql<{ project_id: string | null; name: string | null; company: string | null; minutes: number; billable: number; unbilled: number }[]>`
      select e.project_id, p.name, c.name as company, sum(e.minutes)::int as minutes,
        coalesce(sum(e.minutes) filter (where e.billable), 0)::int as billable,
        coalesce(sum(e.minutes) filter (where e.billable and e.invoice_id is null), 0)::int as unbilled
      from time_entry e
      left join project p on p.id = e.project_id and p.organization_id = e.organization_id
      left join crm_company c on c.id = p.company_id and c.organization_id = p.organization_id
      where e.organization_id = ${org} and e.minutes is not null and e.work_date between ${opts.from} and ${opts.to}
      group by e.project_id, p.name, c.name order by 4 desc`,
    sql<{ date: string; minutes: number }[]>`
      select to_char(d::date, 'YYYY-MM-DD') as date,
        coalesce((select sum(minutes) from time_entry e where e.organization_id = ${org} and e.work_date = d::date and e.minutes is not null), 0)::int as minutes
      from generate_series(${opts.from}::date, ${opts.to}::date, interval '1 day') d order by 1`,
    sql<{ n: number }[]>`select count(*)::int as n from time_timesheet where organization_id = ${org} and status = 'submitted'`,
  ]);
  return {
    total: people.reduce((s, p) => s + p.minutes, 0), billable: people.reduce((s, p) => s + p.billable, 0),
    people: people.map((p) => ({ memberId: p.member_id, name: p.name ?? "Former member", minutes: p.minutes, billable: p.billable })),
    projects: projects.map((p) => ({ projectId: p.project_id, name: p.project_id ? p.name! : "No project", company: p.company, minutes: p.minutes, billable: p.billable, unbilled: p.unbilled })),
    days, pendingTimesheets: pending.n,
  };
}

/**
 * Puts a project's billable hours that aren't on an invoice yet onto a new
 * draft invoice (hours × the rate given), and marks those hours as billed.
 * Deleting the draft frees them again.
 */
export async function billProjectHours(ctx: OrgContext, input: unknown): Promise<{ id: string; number: string; hours: number }> {
  assertPermission(ctx, "time.entry.read_all");
  assertPermission(ctx, "finance.invoice.create");
  const b = parseInput(billHoursSchema, input);
  if (!isUuid(b.projectId)) throw new NotFoundError("Project not found");
  const sql = getDb();
  const [project] = await sql<{ id: string; name: string; company_id: string | null; company: string | null }[]>`
    select p.id, p.name, p.company_id, c.name as company from project p left join crm_company c on c.id = p.company_id and c.organization_id = p.organization_id
    where p.id = ${b.projectId} and p.organization_id = ${ctx.organizationId}`;
  if (!project) throw new NotFoundError("Project not found");
  const entries = await sql<{ id: string; minutes: number; member: string | null; task: string | null }[]>`
    select e.id, e.minutes, pr.name as member, t.title as task
    from time_entry e join organization_member m on m.id = e.member_id left join profile pr on pr.id = m.user_id
    left join project_task t on t.id = e.task_id and t.organization_id = e.organization_id
    where e.organization_id = ${ctx.organizationId} and e.project_id = ${project.id} and e.billable and e.invoice_id is null and e.minutes is not null
      ${b.from ? sql`and e.work_date >= ${b.from}` : sql``} ${b.to ? sql`and e.work_date <= ${b.to}` : sql``}`;
  if (entries.length === 0) throw new ConflictError("There are no billable hours on this project that aren't invoiced yet.");
  const groups = new Map<string, number>();
  for (const e of entries) {
    const key = b.groupBy === "task" ? e.task ?? "General work" : e.member ?? "Team member";
    groups.set(key, (groups.get(key) ?? 0) + e.minutes);
  }
  const lines = [...groups].map(([who, min]) => ({
    description: `${project.name}: ${who} (${formatMinutes(min)} h)`.slice(0, 300),
    quantity: Math.round((min / 60) * 100) / 100, unitPrice: b.rate, taxRate: 0,
  }));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.organization.timezone }).format(new Date());
  const doc = await createDocument(ctx, "invoice", {
    billToName: project.company ?? project.name, companyId: project.company_id, projectId: project.id,
    issueDate: today, dueDate: null, lines,
  });
  const minutes = entries.reduce((s, e) => s + e.minutes, 0);
  await transaction(async (tx) => {
    const ids = entries.map((e) => e.id);
    await tx`update time_entry set invoice_id = ${doc.id}, updated_at = now() where organization_id = ${ctx.organizationId} and id in ${tx(ids)} and invoice_id is null`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "time.hours_billed", targetType: "finance_document", targetId: doc.id,
      metadata: { project: project.name, number: doc.number, hours: (minutes / 60).toFixed(2) } });
  });
  return { id: doc.id, number: doc.number, hours: Math.round((minutes / 60) * 100) / 100 };
}

