import Link from "next/link";
import { Suspense } from "react";
import {
  Activity, ArrowRight, FolderKanban, Handshake, Briefcase, CalendarCheck, Contact, MapPin, UserRound, Building2, CalendarDays, Check, Hourglass, Minus, Timer, TrendingDown, TrendingUp, CircleAlert, CircleCheck, CircleX, Clock3, CreditCard, History, MailPlus, ShieldCheck, Sparkles, UserPlus, Users,
} from "lucide-react";
import { getOverviewCounts } from "@/server/organizations/views";
import { DASHBOARD_RANGES, getDashboard, parseRange, type DashboardRange, type TeamStats } from "@/server/dashboard/dashboard";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DashboardLayout, Widget, type WidgetDef } from "@/modules/dashboard/widgets";
import { ActivityHeatmap } from "@/modules/dashboard/activity-heatmap";
import { CountUp, Departments, EmploymentMix, LeaveByType, Milestones, OutThisWeek, TeamSnapshot } from "@/modules/dashboard/people-widgets";
import { getPeopleInsights } from "@/server/dashboard/people-insights";
import { licenseLabel } from "@/modules/billing/license-view";
import { daysLeft } from "@/lib/billing/entitlements";
import { getLicenseOverview } from "@/server/billing/license";
import { getPeopleStats } from "@/server/people/employees";
import { whoIsOut } from "@/server/people/leave";
import { getPersonalDashboard, type PersonalDashboard } from "@/server/dashboard/personal";
import { LeaveStatusBadge, RequestLeaveDialog } from "@/modules/people/leave-ui";
import { EMPLOYMENT_LABELS, LEAVE_LABELS } from "@/modules/people/labels";
import { listRecentActivity } from "@/server/audit/activity";
import { can } from "@/server/tenancy/context";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { timeAgo, type ActivityItem, type ActivityKind } from "@/lib/activity";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<ActivityKind, typeof Users> = { organization: Building2, member: Users, role: ShieldCheck, billing: CreditCard, people: Contact, crm: Handshake, projects: FolderKanban };

interface HeroFact { label: string; value: number }

function Hero({ firstName, orgName, roleName, actions, personal, today, facts }: { firstName: string; orgName: string; roleName: string; actions: { href: string; label: string; icon: typeof Users }[]; personal: boolean; today: { weekday: string; date: string; greeting: string }; facts: HeroFact[] }) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-navy px-6 py-8 text-white shadow-sm ring-1 ring-white/10 sm:px-8 sm:py-10 dark:bg-[#141414]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(rgb(255_255_255/0.10)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_left,black,transparent_75%)]" />
      <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -right-10 -top-12 -z-10 hidden size-72 text-white/[0.07] sm:block">
        <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 82 L50 16 L72 82" /><path d="M50 10 V82" /><path d="M31 66 H69" /><circle cx="50" cy="66" r="6.5" />
        </g>
      </svg>
      <div className="flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0">
      <p className="motion-safe:animate-rise flex items-center gap-2 text-sm font-medium text-white/60">
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full rounded-full bg-success opacity-70 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        {orgName} <span className="text-white/30">·</span> <span className="text-white/50">Live</span>
      </p>
      <h1 className="motion-safe:animate-rise mt-1 text-2xl font-semibold tracking-tight [animation-delay:60ms] sm:text-3xl">
        {today.greeting}, {firstName}
      </h1>
      <p className="motion-safe:animate-rise mt-2 max-w-xl text-sm text-white/70 [animation-delay:120ms]">
        You&apos;re signed in as <span className="font-medium text-white">{roleName}</span>.{" "}
        {personal ? "Here's your own work at a glance. You see what your role allows." : "Everything below comes straight from your organization's records."}
      </p>
      </div>
      <div className="motion-safe:animate-rise shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 backdrop-blur-sm [animation-delay:140ms]">
        <p className="text-xs font-medium uppercase tracking-widest text-white/50">{today.weekday}</p>
        <p className="text-lg font-semibold">{today.date}</p>
        {facts.length > 0 && (
          <dl className="mt-2 flex gap-4 border-t border-white/10 pt-2">
            {facts.map((f, i) => (
              <div key={f.label}>
                <dt className="text-[11px] text-white/50">{f.label}</dt>
                <dd className="text-base font-semibold"><CountUp value={f.value} delay={300 + i * 120} /></dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      </div>
      {actions.length > 0 && (
        <div className="motion-safe:animate-rise mt-6 flex flex-wrap gap-2 [animation-delay:180ms]">
          {actions.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
                i === 0 ? "bg-white text-navy hover:bg-white/90" : "border border-white/20 bg-white/5 text-white hover:bg-white/10",
              )}
            >
              <a.icon className="size-4" aria-hidden />
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function StatTile({ href, icon: Icon, label, value, limit, hint, index, delta }: { delta?: Delta | null; href: string; icon: typeof Users; label: string; value: number | string; limit?: number | null; hint?: string; index: number }) {
  const pct = limit && typeof value === "number" ? Math.min(100, Math.round((value / limit) * 100)) : null;
  return (
    <Link href={href} className={cn("group motion-safe:animate-rise min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring")} style={{ animationDelay: `${120 + index * 70}ms` }}>
      <Card className="h-full p-4 transition-all sm:p-5 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-sm">
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:-rotate-6"><Icon className="size-4.5" aria-hidden /></span>
          <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
        </div>
        <p className="mt-4 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
          {typeof value === "number" ? <CountUp value={value} delay={200 + index * 70} /> : value}
          {limit ? <span className="text-base font-medium text-muted-foreground"> / {limit}</span> : null}
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{label}</p>
        {delta && <DeltaBadge delta={delta} />}
        {pct !== null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
            <div className={cn("h-full origin-left rounded-full motion-safe:animate-grow-x [animation-delay:350ms]", pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.max(pct, 3)}%` }} />
          </div>
        )}
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </Card>
    </Link>
  );
}

interface Delta { current: number; previous: number; range: number; upIsGood?: boolean }

/** Change vs the previous period of the same length. Text stays in ink colors; the icon carries direction. */
function DeltaBadge({ delta }: { delta: Delta }) {
  const diff = delta.current - delta.previous;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const good = diff === 0 ? null : (diff > 0) === (delta.upIsGood ?? true);
  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
      <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-medium",
        good === null ? "bg-surface-muted text-secondary-foreground" : good ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger")}>
        <Icon className="size-3" aria-hidden />
        {diff > 0 ? "+" : ""}{diff}
      </span>
      <span>vs previous {delta.range} days</span>
    </p>
  );
}

function ListCard({ title, subtitle, action, empty, delay, children }: { title: string; subtitle?: string; action?: { href: string; label: string }; empty?: string | null; delay: number; children?: React.ReactNode }) {
  return (
    <Card className="motion-safe:animate-rise flex h-full min-w-0 flex-col p-5 sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action && <Link href={action.href} className="shrink-0 text-sm font-medium text-primary hover:underline">{action.label}</Link>}
      </div>
      {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      {empty ? <p className="mt-5 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p> : <div className="mt-4 flex-1">{children}</div>}
    </Card>
  );
}

function HBars({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-3.5">
      {rows.map((r, i) => (
        <li key={r.label} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="font-medium tabular-nums">{r.value}<span className="ml-1 text-xs font-normal text-muted-foreground">{total ? Math.round((r.value / total) * 100) : 0}%</span></span>
          </div>
          <div className="h-2 rounded-full bg-primary-subtle" aria-hidden>
            {r.value > 0 && <div className="h-full origin-left rounded-full bg-primary motion-safe:animate-grow-x" style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, animationDelay: `${300 + i * 70}ms` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Meter({ label, used, limit, note }: { label: string; used: number; limit: number | null; note?: string }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">{used}{limit !== null && <span className="font-normal text-muted-foreground"> / {limit}</span>}</span>
      </div>
      <div className="h-2 rounded-full bg-primary-subtle" role="meter" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit ?? used}>
        {limit !== null && used > 0 && <div className={cn("h-full origin-left rounded-full motion-safe:animate-grow-x [animation-delay:400ms]", tone)} style={{ width: `${Math.max(4, pct)}%` }} />}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

const fmtHours = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h * 10) / 10} h` : `${Math.round(h / 24)} days`);
const fmtWhen = (d: Date, now: Date) => {
  const h = (d.getTime() - now.getTime()) / 3_600_000;
  return h < 24 ? `in ${Math.max(1, Math.round(h))} h` : `in ${Math.round(h / 24)} days`;
};

interface Step { title: string; body: string; done: boolean; href?: string; cta?: string }

function SetupChecklist({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <Card className="motion-safe:animate-rise p-5 [animation-delay:300ms] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Get your workspace ready</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{done} of {steps.length} done</p>
        </div>
        <div
          className="grid size-12 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums"
          style={{ background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--surface-muted) 0)` }}
          role="img"
          aria-label={`${pct}% complete`}
        >
          <span className="grid size-9 place-items-center rounded-full bg-surface">{pct}%</span>
        </div>
      </div>
      <ol className="mt-5 grid gap-1">
        {steps.map((s) => (
          <li key={s.title} className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-surface-muted/60">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                s.done ? "border-transparent bg-success text-white" : "border-input bg-surface",
              )}
            >
              {s.done && <Check className="size-3" strokeWidth={3} aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", s.done && "text-muted-foreground line-through decoration-border")}>
                {s.title}
                <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
              </p>
              {!s.done && <p className="mt-0.5 text-xs text-muted-foreground">{s.body}</p>}
            </div>
            {!s.done && s.href && (
              <Link href={s.href} className="shrink-0 text-sm font-medium text-primary hover:underline">
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const now = new Date();
  return (
    <Card className="motion-safe:animate-rise p-5 [animation-delay:360ms] sm:p-6">
      <div className="flex items-center gap-2">
        <History className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-base font-semibold">Recent activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing has happened yet.</p>
      ) : (
        <ol className="relative mt-5 grid gap-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li key={item.id} className="relative flex gap-3">
                <span className="relative">
                  <Avatar name={item.actor} size="md" className="ring-4 ring-surface" />
                  <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-surface text-muted-foreground ring-1 ring-border">
                    <Icon className="size-2.5" aria-hidden />
                  </span>
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm leading-snug [overflow-wrap:anywhere]">
                    <span className="font-medium">{item.actor}</span> <span className="text-secondary-foreground">{item.text}</span>
                  </p>
                  <time dateTime={item.createdAt.toISOString()} className="text-xs text-muted-foreground" title={item.createdAt.toUTCString()}>
                    {timeAgo(item.createdAt, now)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

const fmtLeaveDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const leaveSpan = (start: string, end: string) => (start === end ? fmtLeaveDate(start) : `${fmtLeaveDate(start)} – ${fmtLeaveDate(end)}`);

function MyProfileCard({ me, base }: { me: NonNullable<PersonalDashboard["me"]>; base: string }) {
  const rows = [
    { icon: Briefcase, label: "Job", value: [me.jobTitle, EMPLOYMENT_LABELS[me.employmentType]].filter(Boolean).join(" · ") },
    { icon: Building2, label: "Department", value: me.department?.name ?? "Not set" },
    { icon: UserRound, label: "Reports to", value: me.manager?.name ?? "No manager set" },
    { icon: MapPin, label: "Location", value: me.location ?? "Not set" },
    { icon: CalendarDays, label: "Started", value: me.startDate ? fmtLeaveDate(me.startDate) + `, ${me.startDate.slice(0, 4)}` : "Not set" },
  ];
  return (
    <ListCard title="My profile" subtitle={me.onLeaveToday ? "You're on leave today" : undefined} action={{ href: `${base}/people/${me.id}`, label: "Open" }} delay={160}>
      <div className="flex items-center gap-3">
        <Avatar name={me.fullName} src={me.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{me.fullName}</p>
          <p className="truncate text-sm text-muted-foreground">{me.jobTitle ?? "No job title yet"}</p>
        </div>
      </div>
      <dl className="mt-4 grid gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5 text-sm">
            <r.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="w-24 shrink-0 text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 truncate">{r.value}</dd>
          </div>
        ))}
      </dl>
      {me.reports.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {me.reports.length} {me.reports.length === 1 ? "person reports" : "people report"} to you: {me.reports.slice(0, 3).map((r) => r.name).join(", ")}{me.reports.length > 3 ? "…" : ""}
        </p>
      )}
    </ListCard>
  );
}

function MyLeaveCard({ leave, base, slug }: { leave: PersonalDashboard["leave"]; base: string; slug: string }) {
  const year = new Date().getFullYear();
  return (
    <Card className="motion-safe:animate-rise flex h-full min-w-0 flex-col p-5 [animation-delay:200ms] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">My leave</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Weekends aren&apos;t counted</p>
        </div>
        <RequestLeaveDialog slug={slug} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Taken in {year}</p><p className="mt-1 text-xl font-semibold tabular-nums">{leave.takenTotal}<span className="ml-1 text-xs font-normal text-muted-foreground">d</span></p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Waiting</p><p className="mt-1 text-xl font-semibold tabular-nums">{leave.pending.length}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Coming up</p><p className="mt-1 text-xl font-semibold tabular-nums">{leave.upcoming.length}</p></div>
      </div>
      {leave.takenThisYear.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{leave.takenThisYear.map((t) => `${LEAVE_LABELS[t.type]}: ${t.days} d`).join(" · ")}</p>
      )}
      {[...leave.pending, ...leave.upcoming].length === 0 ? (
        <p className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No pending or upcoming leave.</p>
      ) : (
        <ul className="mt-4 grid gap-2.5">
          {[...leave.pending, ...leave.upcoming].slice(0, 5).map((l) => (
            <li key={l.id} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{LEAVE_LABELS[l.type]}</span> <span className="text-muted-foreground">· {leaveSpan(l.startDate, l.endDate)} · {l.days} d</span></span>
              <LeaveStatusBadge status={l.status} />
            </li>
          ))}
        </ul>
      )}
      <Link href={`${base}/people/leave`} className="mt-4 text-sm font-medium text-primary hover:underline">All my leave</Link>
    </Card>
  );
}

function ComingNext() {
  return (
    <Card className="motion-safe:animate-rise relative overflow-hidden p-5 [animation-delay:420ms] sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 className="text-base font-semibold">Coming next</h2>
        <Badge className="ml-auto">Not available yet</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Live today: your organization, team access, roles, billing, People (directory, departments and leave) CRM (leads, contacts, companies, the deal pipeline and sales reports) and Projects (task boards, milestones, my tasks and workload). Time and Finance arrive in the next milestones.
      </p>
    </Card>
  );
}

function RangeFilter({ base, range, timezone }: { base: string; range: DashboardRange; timezone: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div role="group" aria-label="Date range" className="inline-flex rounded-lg border border-border bg-surface p-0.5 shadow-xs">
        {DASHBOARD_RANGES.map((r) => (
          <Link
            key={r}
            href={r === 30 ? base : `${base}?range=${r}`}
            scroll={false}
            aria-current={r === range ? "true" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              r === range ? "bg-primary text-primary-foreground shadow-xs" : "text-secondary-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {r} days
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Last {range} days · days in {timezone.replaceAll("_", " ")}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children, delay }: { title: string; subtitle: string; children: React.ReactNode; delay: number }) {
  return (
    <Card className="motion-safe:animate-rise min-w-0 p-5 sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function InvitationSummary({ inv, range, href }: { inv: TeamStats["invitations"]; range: number; href: string }) {
  const rows = [
    { label: "Accepted", value: inv.accepted, icon: CircleCheck, tone: "text-success" },
    { label: "Still open", value: Math.max(0, inv.sent - inv.accepted - inv.expired - inv.revoked), icon: Clock3, tone: "text-primary" },
    { label: "Expired", value: inv.expired, icon: CircleAlert, tone: "text-warning" },
    { label: "Revoked", value: inv.revoked, icon: CircleX, tone: "text-muted-foreground" },
  ];
  return (
    <ListCard title="Invitations" subtitle={`${inv.sent} sent in the last ${range} days`} action={{ href, label: "View" }} delay={500}
      empty={inv.sent === 0 ? "No invitations sent in this period." : null}>
      <ul className="grid grid-cols-2 gap-3">
        {rows.map((r) => (
          <li key={r.label} className="rounded-lg border border-border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><r.icon className={cn("size-3.5", r.tone)} aria-hidden />{r.label}</p>
            <p className="mt-1 text-xl font-semibold">{r.value}</p>
          </li>
        ))}
      </ul>
    </ListCard>
  );
}

async function Overview({ params, searchParams }: { params: Promise<{ organizationSlug: string }>; searchParams: Promise<{ range?: string }> }) {
  const [{ organizationSlug }, { range: rangeParam }] = await Promise.all([params, searchParams]);
  const range = parseRange(rangeParam);
  const { user, ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}`;
  const canSeeMembers = can(ctx, "organization.members.read");
  const canInvite = can(ctx, "organization.members.invite");
  const canReadAudit = can(ctx, "organization.audit.read");
  const canBilling = can(ctx, "billing.read");
  const canPeople = can(ctx, "people.employee.read");
  const canLeaveApprove = can(ctx, "people.leave.approve");
  // Plan limits matter to people who pay or add seats; others don't need them.
  const showPlan = canBilling || canInvite;
  const [counts, { license, usage }, feed, dash, peopleStats, out, personal, insights] = await Promise.all([
    canSeeMembers ? getOverviewCounts(ctx) : null,
    getLicenseOverview(ctx.organizationId),
    canReadAudit ? listRecentActivity(ctx, 6) : null,
    getDashboard(ctx, range),
    canPeople ? getPeopleStats(ctx) : null,
    canPeople ? whoIsOut(ctx) : null,
    getPersonalDashboard(ctx),
    canPeople ? getPeopleInsights(ctx) : null,
  ]);
  const tz = ctx.organization.timezone;
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()));
  const today = {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(new Date()),
    date: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: tz }).format(new Date()),
    greeting: hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening",
  };
  const heroFacts: HeroFact[] = peopleStats ? [
    { label: "People", value: peopleStats.headcount },
    { label: "On leave", value: peopleStats.onLeaveToday },
    ...(peopleStats.pendingLeave !== null ? [{ label: "To review", value: peopleStats.pendingLeave }] : []),
  ] : [];
  const now = new Date();
  const ent = license?.entitlements;
  const { team, activity } = dash;
  const planLabel = licenseLabel(license);
  const trialLeft = license?.state === "trial" ? daysLeft(license.trialEndsAt) : null;
  const membersHref = `${base}/settings/members`;

  const actions = [
    ...(canInvite ? [{ href: membersHref, label: "Invite people", icon: UserPlus }] : []),
    ...(can(ctx, "people.employee.create") ? [{ href: `${base}/people`, label: "Add employee", icon: Contact }] : []),
    ...(canLeaveApprove ? [{ href: `${base}/people/leave?tab=team`, label: "Review leave", icon: CalendarCheck }] : []),
    ...(personal.me ? [{ href: `${base}/people/${personal.me.id}`, label: "My profile", icon: UserRound }] : []),
    ...(canPeople && !canSeeMembers ? [{ href: `${base}/people`, label: "Team directory", icon: Users }] : []),
    ...(can(ctx, "organization.roles.manage") ? [{ href: `${base}/settings/roles`, label: "Roles & permissions", icon: ShieldCheck }] : []),
    ...(canBilling ? [{ href: `${base}/settings/billing`, label: "Billing & plan", icon: CreditCard }] : []),
  ];

  const steps: Step[] = [{ title: "Create your workspace", body: "", done: true }];
  if (canInvite && counts) steps.push({ title: "Invite a teammate", body: "Create a join link and share it. It expires after 7 days.", done: counts.members > 1 || counts.pending > 0, href: membersHref, cta: "Invite" });
  if (can(ctx, "organization.roles.manage") && counts && ent?.customRoles) steps.push({ title: "Create a custom role", body: "Give people exactly the access they need.", done: counts.customRoles > 0, href: `${base}/settings/roles`, cta: "Create" });
  if (can(ctx, "billing.manage")) steps.push({ title: "Choose a plan", body: "Your free trial keeps everything open until it ends.", done: license?.source === "paddle", href: `${base}/settings/billing`, cta: "See plans" });
  const showChecklist = steps.length > 1 && steps.some((s) => !s.done);

  const acceptance = team && team.invitations.sent > 0 ? Math.round((team.invitations.accepted / team.invitations.sent) * 100) : null;
  const busiestDay = activity?.byDay.reduce((best, d) => (d.value > best.value ? d : best), { day: "", value: 0 });
  const fmtDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  const personalView = !team && !activity;
  const showKpis = Boolean(team || activity || showPlan);
  const personalWidgets: WidgetDef[] = [
    ...(personal.me ? [{ id: "me", label: "My profile" }] : []),
    ...(personal.leave.canRequest ? [{ id: "myleave", label: "My leave" }] : []),
  ];
  const personalRow = personalWidgets.length > 0 && (
    <div className="grid gap-6 lg:grid-cols-2">
      {personal.me && <Widget id="me"><MyProfileCard me={personal.me} base={base} /></Widget>}
      {personal.leave.canRequest && <Widget id="myleave"><MyLeaveCard leave={personal.leave} base={base} slug={ctx.organization.slug} /></Widget>}
    </div>
  );

  const widgets: WidgetDef[] = [
    ...(personalView ? personalWidgets : []),
    ...(showKpis ? [{ id: "kpis", label: "Key numbers" }] : []),
    ...(team || activity ? [{ id: "trends", label: "Trend charts" }] : []),
    ...(activity ? [{ id: "heatmap", label: "When your team works" }, { id: "areas", label: "Changes by area" }, { id: "top", label: "Most active people" }] : []),
    ...(team ? [{ id: "roles", label: "Team by role" }, { id: "joined", label: "Recently joined" }, { id: "invites", label: "Invitations" }, { id: "expiring", label: "Expiring invitations" }] : []),
    ...(peopleStats ? [{ id: "people", label: "People today" }] : []),
    ...(insights ? [{ id: "outweek", label: "Out this week" }, { id: "mix", label: "Employment mix" }, { id: "depts", label: "Headcount by department" }, { id: "snapshot", label: "Team snapshot" }, { id: "milestones", label: "Milestones" }] : []),
    ...(insights?.leaveDaysByType ? [{ id: "leavetypes", label: "Leave taken this year" }] : []),
    ...(!personalView ? personalWidgets : []),
    ...(showPlan ? [{ id: "usage", label: "Plan usage" }] : []),
    ...(feed ? [{ id: "feed", label: "Recent activity" }] : []),
    ...(showChecklist ? [{ id: "setup", label: "Setup checklist" }] : []),
    { id: "next", label: "Coming next" },
  ];

  return (
    <div className="grid gap-6">
      <Hero firstName={user.name.split(" ")[0] || "there"} orgName={ctx.organization.name} roleName={ctx.roleName} actions={actions} personal={personalView} today={today} facts={heroFacts} />

      <DashboardLayout storageKey={`aoient-dashboard-hidden:${ctx.organization.slug}`} widgets={widgets}
        exportHref={team || activity ? `${base}/dashboard-export?range=${range}` : null}
        filter={team || activity ? <RangeFilter base={base} range={range} timezone={dash.timezone} /> : null}>

        {personalView && personalRow}

        {showKpis && <Widget id="kpis">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {team && (
              <>
                <StatTile index={0} href={membersHref} icon={Users} label="Active members" value={team.activeMembers}
                  limit={ent ? ent.maxMembers : null} delta={{ current: team.joinedInRange, previous: team.joinedPrevRange, range }}
                  hint={`${team.joinedInRange} joined, ${team.joinedPrevRange} in the ${range} days before`} />
                <StatTile index={1} href={membersHref} icon={MailPlus} label="Pending invitations" value={team.invitations.pending}
                  hint={team.invitations.expiringSoon > 0 ? `${team.invitations.expiringSoon} expire within 48 h` : "None expiring soon"} />
                <StatTile index={2} href={membersHref} icon={CircleCheck} label="Invites accepted" value={acceptance === null ? "—" : `${acceptance}%`}
                  hint={team.invitations.sent > 0 ? `${team.invitations.accepted} of ${team.invitations.sent} sent (${team.sentPrevRange} sent the ${range} days before)` : `None sent in ${range} days`} />
              </>
            )}
            {showPlan && <StatTile index={3} href={canBilling ? `${base}/settings/billing` : base} icon={Sparkles} label={license ? `${license.planName} plan` : "Plan"}
              value={trialLeft !== null ? `${trialLeft} d` : planLabel.text.split(" · ")[0]}
              hint={trialLeft !== null
                ? (license?.source === "paddle" ? "Free trial left, then billing starts" : "Free trial left")
                : license?.state === "active" ? `Paid ${license.billingInterval === "yearly" ? "yearly" : "monthly"} subscription` : planLabel.text} />}
            {activity && (
              <StatTile index={4} href={base} icon={Activity} label="Changes recorded" value={activity.total}
                delta={{ current: activity.total, previous: activity.totalPrevRange, range }}
                hint={`${(activity.total / range).toFixed(1)} per day on average (${activity.totalPrevRange} the ${range} days before)`} />
            )}
            {activity && (
              <StatTile index={5} href={base} icon={CalendarDays} label="Busiest day" value={busiestDay && busiestDay.value > 0 ? busiestDay.value : "—"}
                hint={busiestDay && busiestDay.value > 0 ? `${fmtDay(busiestDay.day)}` : "No changes in this period"} />
            )}
            {team && (
              <StatTile index={6} href={membersHref} icon={Timer} label="Time to accept" value={team.medianAcceptHours === null ? "—" : fmtHours(team.medianAcceptHours)}
                hint={team.medianAcceptHours === null ? `No invites accepted in ${range} days` : "Median, invitation to joining"} />
            )}
            {team && (
              <StatTile index={7} href={membersHref} icon={ShieldCheck} label="Owners & admins" value={team.adminMembers}
                limit={ent ? ent.maxAdminSeats : null}
                hint={team.suspendedMembers > 0 ? `${team.suspendedMembers} suspended member${team.suspendedMembers === 1 ? "" : "s"}` : "No suspended members"} />
            )}
          </div>
        </Widget>}

        {(team || activity) && (
          <Widget id="trends">
            <div className="grid gap-6 lg:grid-cols-2">
              {team && (
                <ChartCard title="Team size" subtitle="Current active members, by the day they joined" delay={220}>
                  <TimeSeriesChart data={team.teamByDay} kind="area" valueLabel="Members" unit={["member", "members"]} />
                </ChartCard>
              )}
              {activity && (
                <ChartCard title="Workspace activity" subtitle={`${activity.total} recorded changes in ${range} days`} delay={280}>
                  <TimeSeriesChart data={activity.byDay} kind="bar" valueLabel="Changes" unit={["change", "changes"]} />
                </ChartCard>
              )}
            </div>
          </Widget>
        )}

        {activity && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Widget id="heatmap" className="lg:col-span-2">
              <ListCard title="When your team works" subtitle={`Changes by weekday and hour · ${dash.timezone.replaceAll("_", " ")}`} delay={300}>
                <ActivityHeatmap grid={activity.heatmap} timezone={dash.timezone} />
              </ListCard>
            </Widget>
            <Widget id="areas">
              <ListCard title="Changes by area" subtitle={`Last ${range} days`} delay={340} empty={activity.total === 0 ? "No changes in this period." : null}>
                <HBars rows={activity.byArea.map((a) => ({ label: a.area, value: a.count }))} total={activity.total} />
              </ListCard>
            </Widget>
          </div>
        )}

        {insights && peopleStats && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Widget id="outweek" className="lg:col-span-2"><OutThisWeek insights={insights} base={`${base}`} delay={320} /></Widget>
            <Widget id="mix"><EmploymentMix byType={peopleStats.byType} headcount={peopleStats.headcount} delay={360} /></Widget>
          </div>
        )}
        {insights && peopleStats && (
          <div className={cn("grid gap-6 md:grid-cols-2", !insights.leaveDaysByType && "xl:grid-cols-3")}>
            <Widget id="depts"><Departments insights={insights} base={base} headcount={peopleStats.headcount} delay={380} /></Widget>
            <Widget id="snapshot"><TeamSnapshot insights={insights} delay={420} /></Widget>
            <Widget id="milestones"><Milestones insights={insights} base={base} delay={460} /></Widget>
            {insights.leaveDaysByType && <Widget id="leavetypes"><LeaveByType rows={insights.leaveDaysByType} delay={500} /></Widget>}
          </div>
        )}

        {!personalView && personalRow}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {team && (
            <Widget id="roles">
              <ListCard title="Team by role" subtitle={`${team.activeMembers} active ${team.activeMembers === 1 ? "member" : "members"}`} action={{ href: `${base}/settings/roles`, label: "Manage" }} delay={360}>
                <HBars rows={team.roles.map((r) => ({ label: r.name, value: r.count }))} total={team.activeMembers} />
              </ListCard>
            </Widget>
          )}
          {peopleStats && out && (
            <Widget id="people">
              <ListCard title="People today" subtitle={`${peopleStats.headcount} active · ${peopleStats.departments} departments`} action={{ href: `${base}/people`, label: "Open" }} delay={380}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">On leave today</p><p className="mt-1 text-xl font-semibold">{peopleStats.onLeaveToday}</p></div>
                  {peopleStats.pendingLeave !== null ? (
                    <Link href={`${base}/people/leave?tab=team`} className="rounded-lg border border-border p-3 hover:border-primary/40"><p className="text-xs text-muted-foreground">Leave to review</p><p className="mt-1 text-xl font-semibold">{peopleStats.pendingLeave}</p></Link>
                  ) : (
                    <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Started this month</p><p className="mt-1 text-xl font-semibold">{peopleStats.joinedThisMonth}</p></div>
                  )}
                </div>
                {out.length > 0 && (
                  <ul className="mt-3 grid gap-2">
                    {out.slice(0, 4).map((o) => (
                      <li key={o.id} className="flex items-center gap-2 text-sm"><Avatar name={o.name} size="sm" /><span className="truncate">{o.name}</span><span className="ml-auto text-xs text-muted-foreground">{o.type} leave</span></li>
                    ))}
                  </ul>
                )}
              </ListCard>
            </Widget>
          )}
          {showPlan && <Widget id="usage">
            <ListCard title="Plan usage" subtitle={license ? `${license.planName} limits, checked on every change` : "No active plan"} action={canBilling ? { href: `${base}/settings/billing`, label: "Billing" } : undefined} delay={400}>
              {ent ? (
                <div className="grid gap-4">
                  <Meter label="Users (members + pending)" used={usage.activeMembers + usage.pendingInvitations} limit={ent.maxMembers} />
                  <Meter label="Admin seats" used={usage.adminSeats} limit={ent.maxAdminSeats} />
                  <Meter label="Custom roles" used={usage.customRoles} limit={ent.customRoles ? null : 0} note={ent.customRoles ? "Unlimited on this plan" : `Not included in ${license?.planName}`} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This workspace is read-only until a plan is active.</p>
              )}
            </ListCard>
          </Widget>}
          {activity && (
            <Widget id="top">
              <ListCard title="Most active people" subtitle={`Recorded changes in ${range} days`} delay={440} empty={activity.topPeople.length === 0 ? "No changes in this period." : null}>
                <ol className="grid gap-3">
                  {activity.topPeople.map((p, i) => (
                    <li key={p.name} className="flex items-center gap-3">
                      <span className="w-4 text-xs font-medium text-muted-foreground tabular-nums">{i + 1}</span>
                      <Avatar name={p.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                      <span className="text-sm font-medium tabular-nums">{p.count}</span>
                    </li>
                  ))}
                </ol>
              </ListCard>
            </Widget>
          )}
          {team && (
            <Widget id="joined">
              <ListCard title="Recently joined" action={{ href: membersHref, label: "All members" }} delay={480}>
                <ul className="grid gap-3">
                  {team.recentlyJoined.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <Avatar name={m.name} size="sm" />
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate text-sm font-medium">{m.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{m.roleName}</span>
                      </span>
                      <time dateTime={m.joinedAt.toISOString()} className="shrink-0 text-xs text-muted-foreground">{timeAgo(m.joinedAt, now)}</time>
                    </li>
                  ))}
                </ul>
              </ListCard>
            </Widget>
          )}
          {team && (
            <Widget id="invites">
              <InvitationSummary inv={team.invitations} range={range} href={membersHref} />
            </Widget>
          )}
          {team && (
            <Widget id="expiring">
              <ListCard title="Expiring invitations" subtitle="Pending links that stop working within 3 days" action={{ href: membersHref, label: "Renew" }} delay={520}
                empty={team.expiringInvites.length === 0 ? "Nothing is about to expire." : null}>
                <ul className="grid gap-3">
                  {team.expiringInvites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warning-subtle text-warning"><Hourglass className="size-3.5" aria-hidden /></span>
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate text-sm font-medium">{i.email}</span>
                        <span className="truncate text-xs text-muted-foreground">{i.roleName}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-secondary-foreground">{fmtWhen(i.expiresAt, now)}</span>
                    </li>
                  ))}
                </ul>
              </ListCard>
            </Widget>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {feed && <Widget id="feed" className="lg:col-span-3"><ActivityFeed items={feed} /></Widget>}
          <div className={cn("grid content-start gap-6", feed ? "lg:col-span-2" : "lg:col-span-5")}>
            {showChecklist && <Widget id="setup"><SetupChecklist steps={steps} /></Widget>}
            <Widget id="next"><ComingNext /></Widget>
          </div>
        </div>
      </DashboardLayout>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-52 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
      <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  );
}

export default function WorkspaceHome({ params, searchParams }: PageProps<"/[organizationSlug]">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview params={params} searchParams={searchParams as Promise<{ range?: string }>} />
    </Suspense>
  );
}
