import "server-only";
import { can, type OrgContext } from "@/server/tenancy/context";
import { getCrmReport } from "@/server/crm/reports";
import { getFinanceOverview } from "@/server/finance/reports";
import { listProjects } from "@/server/projects/projects";
import { listMyTasks } from "@/server/projects/tasks";
import { getTimeReport } from "@/server/time/reports";
import { getWeek } from "@/server/time/timesheets";
import { todayIn } from "@/server/time/entries";
import { getPeopleStats } from "@/server/people/employees";
import { getDashboard } from "@/server/dashboard/dashboard";
import { money } from "@/modules/crm/labels";
import { addDays, formatMinutes, weekStartOf } from "@/lib/validation/time";

/**
 * Analytics summaries for the assistant, built from the same services as the
 * module pages, so they only include what this person's role can open there.
 */
export type SummaryModule = "sales" | "finance" | "projects" | "time" | "people" | "team";
export interface SummarySection { module: SummaryModule; title: string; line: string; stats: { label: string; value: string }[]; href: string }

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function moduleFromQuestion(q: string): SummaryModule | null {
  const s = q.toLowerCase();
  if (/\b(sales|crm|deals?|pipeline|leads?|customers?)\b/.test(s)) return "sales";
  if (/\b(finance|money|invoices?|payments?|expenses?|cash|revenue|income|paisa|paise|kharch\w*|hisaab)\b/.test(s)) return "finance";
  if (/\b(projects?|tasks?|delivery|kaam)\b/.test(s)) return "projects";
  if (/\b(time|hours|timesheets?|ghante|waqt)\b/.test(s)) return "time";
  if (/\b(people|hr|staff|employees?|leave|chutti)\b/.test(s)) return "people";
  if (/\b(team|members?|invitations?)\b/.test(s)) return "team";
  return null;
}

export async function buildSummary(ctx: OrgContext, only: SummaryModule | null): Promise<SummarySection[]> {
  const base = `/${ctx.organization.slug}`;
  const want = (m: SummaryModule) => only === null || only === m;
  const tasks: Promise<SummarySection | null>[] = [];
  const cur = ctx.organization.currency;

  if (want("sales") && can(ctx, "crm.report.read")) tasks.push(getCrmReport(ctx).then((r) => ({
    module: "sales" as const, title: "Sales", href: `${base}/crm/reports`,
    line: `${plural(r.openCount, "open deal")} worth ${money(r.openValue, cur, true)} in the pipeline; ${plural(r.wonThisMonth.count, "deal")} won this month.`,
    stats: [
      { label: "Open pipeline", value: money(r.openValue, cur, true) }, { label: "Weighted", value: money(r.weightedValue, cur, true) },
      { label: "Won this month", value: `${money(r.wonThisMonth.value, cur, true)} · ${r.wonThisMonth.count}` }, { label: "Win rate (90 d)", value: pct(r.winRate) },
      { label: "New leads this month", value: String(r.newLeadsThisMonth) }, { label: "Lead conversion", value: pct(r.conversionRate) },
    ],
  })));

  if (want("finance") && can(ctx, "finance.report.read")) tasks.push(getFinanceOverview(ctx).then((o) => ({
    module: "finance" as const, title: "Finance", href: `${base}/finance`,
    line: `${money(o.outstanding, cur, true)} is owed to you${o.overdue ? `, ${money(o.overdue, cur, true)} of it overdue` : ""}. This month: ${money(o.thisMonth.income, cur, true)} in, ${money(o.thisMonth.expenses, cur, true)} out.`,
    stats: [
      { label: "Owed to you", value: `${money(o.outstanding, cur, true)} · ${o.outstandingCount}` }, { label: "Overdue", value: `${money(o.overdue, cur, true)} · ${o.overdueCount}` },
      { label: "Received this month", value: money(o.thisMonth.income, cur, true) }, { label: "Spent this month", value: money(o.thisMonth.expenses, cur, true) },
      { label: "Net this month", value: money(o.thisMonth.net, cur, true) }, { label: "Expenses to approve", value: String(o.pendingExpenses.count) },
    ],
  })));

  if (want("projects") && can(ctx, "projects.project.read")) tasks.push(Promise.all([listProjects(ctx, { status: "open" }), can(ctx, "projects.task.read") ? listMyTasks(ctx) : []]).then(([ps, mine]) => {
    const today = todayIn(ctx.organization.timezone);
    const total = ps.reduce((s, p) => s + p.tasks.total, 0), done = ps.reduce((s, p) => s + p.tasks.done, 0), overdue = ps.reduce((s, p) => s + p.tasks.overdue, 0);
    const myOpen = mine.filter((t) => t.status !== "done");
    const myLate = myOpen.filter((t) => t.dueDate && t.dueDate < today).length;
    const late = ps.filter((p) => p.dueDate && p.dueDate < today).length;
    return {
      module: "projects" as const, title: "Projects", href: `${base}/projects`,
      line: `${plural(ps.length, "open project")}, ${total ? Math.round((done / total) * 100) : 0}% of their tasks done; ${plural(overdue, "task")} overdue.`,
      stats: [
        { label: "Open projects", value: String(ps.length) }, { label: "Tasks done", value: `${done} / ${total}` },
        { label: "Overdue tasks", value: String(overdue) }, { label: "Projects past due", value: String(late) },
        { label: "My open tasks", value: String(myOpen.length) }, { label: "My overdue", value: String(myLate) },
      ],
    };
  }));

  if (want("time") && (can(ctx, "time.entry.read_all") || can(ctx, "time.entry.own"))) {
    const today = todayIn(ctx.organization.timezone), w = weekStartOf(today);
    tasks.push(can(ctx, "time.entry.read_all")
      ? getTimeReport(ctx, { from: w, to: addDays(w, 6) }).then((r) => {
        const unbilled = r.projects.reduce((s, p) => s + p.unbilled, 0);
        const top = r.people[0];
        return {
          module: "time" as const, title: "Time (this week)", href: `${base}/time/reports`,
          line: `The team logged ${formatMinutes(r.total)} h this week, ${r.total ? Math.round((r.billable / r.total) * 100) : 0}% billable.${top ? ` Most hours: ${top.name} (${formatMinutes(top.minutes)}).` : ""}`,
          stats: [
            { label: "Hours logged", value: formatMinutes(r.total) }, { label: "Billable", value: formatMinutes(r.billable) },
            { label: "Not invoiced yet", value: formatMinutes(unbilled) }, { label: "Timesheets to approve", value: String(r.pendingTimesheets) },
          ],
        };
      })
      : getWeek(ctx, { weekStart: w }).then((wk) => ({
        module: "time" as const, title: "My time (this week)", href: `${base}/time`,
        line: `You logged ${formatMinutes(wk.total)} h this week.`,
        stats: [{ label: "Hours", value: formatMinutes(wk.total) }, { label: "Billable", value: formatMinutes(wk.billable) }, { label: "Timesheet", value: wk.status === "open" ? "Not submitted" : wk.status }],
      })));
  }

  if (want("people") && can(ctx, "people.employee.read")) tasks.push(getPeopleStats(ctx).then((p) => ({
    module: "people" as const, title: "People", href: `${base}/people`,
    line: `${plural(p.headcount, "employee")} in ${plural(p.departments, "department")}; ${p.onLeaveToday} on leave today.`,
    stats: [
      { label: "Headcount", value: String(p.headcount) }, { label: "On leave today", value: String(p.onLeaveToday) },
      { label: "Joined this month", value: String(p.joinedThisMonth) }, ...(p.pendingLeave !== null ? [{ label: "Leave to approve", value: String(p.pendingLeave) }] : []),
    ],
  })));

  if (want("team") && can(ctx, "organization.members.manage")) tasks.push(getDashboard(ctx, 30).then((d) => ({
    module: "team" as const, title: "Team", href: `${base}/settings/members`,
    line: `${plural(d.team!.activeMembers, "active member")}; ${d.team!.joinedInRange} joined in the last 30 days.`,
    stats: [
      { label: "Active members", value: String(d.team!.activeMembers) }, { label: "Pending invitations", value: String(d.team!.invitations.pending) },
      ...(d.activity ? [{ label: "Changes (30 d)", value: String(d.activity.total) }] : []),
    ],
  })));

  return (await Promise.all(tasks)).filter((x): x is SummarySection => x !== null);
}
