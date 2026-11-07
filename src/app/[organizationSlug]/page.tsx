import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight, Building2, Check, CircleAlert, CircleCheck, CircleX, Clock3, CreditCard, History, MailPlus, ShieldCheck, Sparkles, UserPlus, Users,
} from "lucide-react";
import { getOverviewCounts } from "@/server/organizations/views";
import { DASHBOARD_RANGES, getDashboard, parseRange, type DashboardRange, type TeamStats } from "@/server/dashboard/dashboard";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { licenseLabel } from "@/modules/billing/license-view";
import { daysLeft } from "@/lib/billing/entitlements";
import { getLicenseOverview } from "@/server/billing/license";
import { listRecentActivity } from "@/server/audit/activity";
import { can } from "@/server/tenancy/context";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { timeAgo, type ActivityItem, type ActivityKind } from "@/lib/activity";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<ActivityKind, typeof Users> = { organization: Building2, member: Users, role: ShieldCheck, billing: CreditCard };

function Hero({ firstName, orgName, roleName, actions }: { firstName: string; orgName: string; roleName: string; actions: { href: string; label: string; icon: typeof Users }[] }) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-navy px-6 py-8 text-white shadow-sm ring-1 ring-white/10 sm:px-8 sm:py-10 dark:bg-[#141a2e]">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 -z-10 size-72 rounded-full bg-violet-500/40 blur-3xl motion-safe:animate-blob" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 right-40 -z-10 size-64 rounded-full bg-orange-400/25 blur-3xl motion-safe:animate-blob [animation-delay:-6s]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
      <p className="motion-safe:animate-rise text-sm font-medium text-white/60">{orgName}</p>
      <h1 className="motion-safe:animate-rise mt-1 text-2xl font-semibold tracking-tight [animation-delay:60ms] sm:text-3xl">
        Welcome back, {firstName}
      </h1>
      <p className="motion-safe:animate-rise mt-2 max-w-xl text-sm text-white/70 [animation-delay:120ms]">
        You&apos;re signed in as <span className="font-medium text-white">{roleName}</span>. Everything below comes straight from your organization&apos;s records.
      </p>
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

function StatTile({ href, icon: Icon, label, value, limit, hint, index }: { href: string; icon: typeof Users; label: string; value: number | string; limit?: number | null; hint?: string; index: number }) {
  const pct = limit && typeof value === "number" ? Math.min(100, Math.round((value / limit) * 100)) : null;
  return (
    <Link href={href} className={cn("group motion-safe:animate-rise min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring")} style={{ animationDelay: `${120 + index * 70}ms` }}>
      <Card className="h-full p-4 transition-all sm:p-5 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-sm">
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-primary"><Icon className="size-4.5" aria-hidden /></span>
          <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
        </div>
        <p className="mt-4 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
          {value}
          {limit ? <span className="text-base font-medium text-muted-foreground"> / {limit}</span> : null}
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{label}</p>
        {pct !== null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
            <div className={cn("h-full rounded-full", pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.max(pct, 3)}%` }} />
          </div>
        )}
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </Card>
    </Link>
  );
}

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

function ComingNext() {
  return (
    <Card className="motion-safe:animate-rise relative overflow-hidden p-5 [animation-delay:420ms] sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 className="text-base font-semibold">Coming next</h2>
        <Badge className="ml-auto">Not available yet</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        This release covers your organization, team access, roles and billing. People, CRM, Projects, Time and Finance arrive in the next milestones.
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

function RoleBreakdown({ roles, total, href }: { roles: { name: string; count: number }[]; total: number; href: string }) {
  const max = Math.max(1, ...roles.map((r) => r.count));
  return (
    <Card className="motion-safe:animate-rise p-5 [animation-delay:340ms] sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Team by role</h2>
        <Link href={href} className="text-sm font-medium text-primary hover:underline">Manage</Link>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{total} active {total === 1 ? "member" : "members"}</p>
      <ul className="mt-5 grid gap-3.5">
        {roles.map((r) => (
          <li key={r.name} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{r.name}</span>
              <span className="font-medium tabular-nums">{r.count}<span className="ml-1 text-xs font-normal text-muted-foreground">{Math.round((r.count / Math.max(total, 1)) * 100)}%</span></span>
            </div>
            <div className="h-2 rounded-full bg-primary-subtle" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function InvitationSummary({ inv, range, href }: { inv: TeamStats["invitations"]; range: number; href: string }) {
  const rows = [
    { label: "Accepted", value: inv.accepted, icon: CircleCheck, tone: "text-success" },
    { label: "Still open", value: inv.sent - inv.accepted - inv.expired - inv.revoked, icon: Clock3, tone: "text-primary" },
    { label: "Expired", value: inv.expired, icon: CircleAlert, tone: "text-warning" },
    { label: "Revoked", value: inv.revoked, icon: CircleX, tone: "text-muted-foreground" },
  ];
  return (
    <Card className="motion-safe:animate-rise p-5 [animation-delay:400ms] sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Invitations</h2>
        <Link href={href} className="text-sm font-medium text-primary hover:underline">View</Link>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{inv.sent} sent in the last {range} days</p>
      {inv.sent === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No invitations sent in this period.</p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3">
          {rows.map((r) => (
            <li key={r.label} className="rounded-lg border border-border p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><r.icon className={cn("size-3.5", r.tone)} aria-hidden />{r.label}</p>
              <p className="mt-1 text-xl font-semibold">{r.value}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
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
  const [counts, { license }, activity, dash] = await Promise.all([
    canSeeMembers ? getOverviewCounts(ctx) : null,
    getLicenseOverview(ctx.organizationId),
    canReadAudit ? listRecentActivity(ctx, 6) : null,
    getDashboard(ctx, range),
  ]);
  const ent = license?.entitlements;
  const team = dash.team;
  const planLabel = licenseLabel(license);
  const trialLeft = license?.state === "trial" ? daysLeft(license.trialEndsAt) : null;

  const actions = [
    ...(canInvite ? [{ href: `${base}/settings/members`, label: "Invite people", icon: UserPlus }] : []),
    ...(canSeeMembers ? [{ href: `${base}/settings/roles`, label: "Roles & permissions", icon: ShieldCheck }] : []),
    ...(canBilling ? [{ href: `${base}/settings/billing`, label: "Billing & plan", icon: CreditCard }] : []),
  ];

  const steps: Step[] = [{ title: "Create your workspace", body: "", done: true }];
  if (canInvite && counts) {
    steps.push({ title: "Invite a teammate", body: "Create a join link and share it. It expires after 7 days.", done: counts.members > 1 || counts.pending > 0, href: `${base}/settings/members`, cta: "Invite" });
  }
  if (can(ctx, "organization.roles.manage") && counts && ent?.customRoles) {
    steps.push({ title: "Create a custom role", body: "Give people exactly the access they need.", done: counts.customRoles > 0, href: `${base}/settings/roles`, cta: "Create" });
  }
  if (can(ctx, "billing.manage")) {
    steps.push({ title: "Choose a plan", body: "Your free trial keeps everything open until it ends.", done: license?.source === "paddle", href: `${base}/settings/billing`, cta: "See plans" });
  }
  const showChecklist = steps.length > 1 && steps.some((s) => !s.done);
  const acceptance = team && team.invitations.sent > 0 ? Math.round((team.invitations.accepted / team.invitations.sent) * 100) : null;

  return (
    <div className="grid gap-6">
      <Hero firstName={user.name.split(" ")[0] || "there"} orgName={ctx.organization.name} roleName={ctx.roleName} actions={actions} />

      {(team || dash.activityByDay) && <RangeFilter base={base} range={range} timezone={dash.timezone} />}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {team && counts && (
          <>
            <StatTile index={0} href={`${base}/settings/members`} icon={Users} label="Active members" value={team.activeMembers}
              limit={ent ? ent.maxMembers : null}
              hint={team.joinedInRange > 0 ? `+${team.joinedInRange} joined in ${range} days` : `No one joined in ${range} days`} />
            <StatTile index={1} href={`${base}/settings/members`} icon={MailPlus} label="Pending invitations" value={team.invitations.pending}
              hint={team.invitations.expiringSoon > 0 ? `${team.invitations.expiringSoon} expire within 48 h` : "None expiring soon"} />
            <StatTile index={2} href={`${base}/settings/members`} icon={CircleCheck} label="Invites accepted" value={acceptance === null ? "—" : `${acceptance}%`}
              hint={team.invitations.sent > 0 ? `${team.invitations.accepted} of ${team.invitations.sent} sent in ${range} days` : `None sent in ${range} days`} />
          </>
        )}
        <StatTile index={3} href={canBilling ? `${base}/settings/billing` : base} icon={Sparkles} label={license ? `${license.planName} plan` : "Plan"}
          value={trialLeft !== null ? `${trialLeft} d` : planLabel.text.split(" · ")[0]}
          hint={trialLeft !== null
            ? (license?.source === "paddle" ? "Free trial left, then billing starts" : "Free trial left")
            : license?.state === "active" ? `Paid ${license.billingInterval === "yearly" ? "yearly" : "monthly"} subscription` : planLabel.text} />
      </div>

      {(team || dash.activityByDay) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {team && (
            <ChartCard title="Team size" subtitle="Current active members, by the day they joined" delay={220}>
              <TimeSeriesChart data={team.teamByDay} kind="area" valueLabel="Members" unit={["member", "members"]} />
            </ChartCard>
          )}
          {dash.activityByDay && (
            <ChartCard title="Workspace activity" subtitle={`${dash.activityByDay.reduce((a, d) => a + d.value, 0)} recorded changes in ${range} days`} delay={280}>
              <TimeSeriesChart data={dash.activityByDay} kind="bar" valueLabel="Changes" unit={["change", "changes"]} />
            </ChartCard>
          )}
        </div>
      )}

      {team && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RoleBreakdown roles={team.roles} total={team.activeMembers} href={`${base}/settings/roles`} />
          <InvitationSummary inv={team.invitations} range={range} href={`${base}/settings/members`} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="grid content-start gap-6 lg:col-span-3">
          {activity && <ActivityFeed items={activity} />}
          {!activity && <ComingNext />}
        </div>
        <div className="grid content-start gap-6 lg:col-span-2">
          {showChecklist && <SetupChecklist steps={steps} />}
          {activity && <ComingNext />}
          {!showChecklist && (
            <Card className="motion-safe:animate-rise p-5 [animation-delay:480ms] sm:p-6">
              <h2 className="text-base font-semibold">Your access</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;re <span className="font-medium text-foreground">{ctx.roleName}</span> in {ctx.organization.name}. What you can see and change is checked on the server for every request.
              </p>
            </Card>
          )}
        </div>
      </div>
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
