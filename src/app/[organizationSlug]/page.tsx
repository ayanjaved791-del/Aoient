import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight, Building2, Check, CreditCard, History, MailPlus, ShieldCheck, Sparkles, UserPlus, Users,
} from "lucide-react";
import { getOverviewCounts } from "@/server/organizations/views";
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

function StatTile({ href, icon: Icon, label, value, limit, hint, index, wide }: { wide?: boolean; href: string; icon: typeof Users; label: string; value: number; limit?: number | null; hint?: string; index: number }) {
  const pct = limit ? Math.min(100, Math.round((value / limit) * 100)) : null;
  return (
    <Link href={href} className={cn("group motion-safe:animate-rise min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring", wide && "col-span-2 sm:col-span-1")} style={{ animationDelay: `${120 + index * 70}ms` }}>
      <Card className="h-full p-4 transition-all sm:p-5 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-sm">
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-primary"><Icon className="size-4.5" aria-hidden /></span>
          <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
        </div>
        <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight">
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

async function Overview({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { user, ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}`;
  const canSeeMembers = can(ctx, "organization.members.read");
  const canInvite = can(ctx, "organization.members.invite");
  const canReadAudit = can(ctx, "organization.audit.read");
  const canBilling = can(ctx, "billing.read");
  const [counts, { license }, activity] = await Promise.all([
    canSeeMembers ? getOverviewCounts(ctx) : null,
    getLicenseOverview(ctx.organizationId),
    canReadAudit ? listRecentActivity(ctx, 8) : null,
  ]);
  const ent = license?.entitlements;

  const actions = [
    ...(canInvite ? [{ href: `${base}/settings/members`, label: "Invite people", icon: UserPlus }] : []),
    ...(canSeeMembers ? [{ href: `${base}/settings/roles`, label: "Roles & permissions", icon: ShieldCheck }] : []),
    ...(canBilling ? [{ href: `${base}/settings/billing`, label: "Billing & plan", icon: CreditCard }] : []),
  ];

  const steps: Step[] = [{ title: "Create your workspace", body: "", done: true }];
  if (canInvite && counts) {
    steps.push({ title: "Invite a teammate", body: "Send an invitation link by email. It expires after 7 days.", done: counts.members > 1 || counts.pending > 0, href: `${base}/settings/members`, cta: "Invite" });
  }
  if (can(ctx, "organization.roles.manage") && counts && ent?.customRoles) {
    steps.push({ title: "Create a custom role", body: "Give people exactly the access they need.", done: counts.customRoles > 0, href: `${base}/settings/roles`, cta: "Create" });
  }
  if (can(ctx, "billing.manage")) {
    steps.push({ title: "Choose a plan", body: "Your free trial keeps everything open until it ends.", done: license?.source === "paddle", href: `${base}/settings/billing`, cta: "See plans" });
  }

  return (
    <div className="grid gap-6">
      <Hero firstName={user.name.split(" ")[0] || "there"} orgName={ctx.organization.name} roleName={ctx.roleName} actions={actions} />

      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatTile wide index={0} href={`${base}/settings/members`} icon={Users} label="Active members" value={counts.members}
            limit={ent ? ent.maxMembers : null} hint={ent ? "Seats include pending invitations" : undefined} />
          <StatTile index={1} href={`${base}/settings/members`} icon={MailPlus} label="Pending invitations" value={counts.pending} />
          <StatTile index={2} href={`${base}/settings/roles`} icon={ShieldCheck} label="Custom roles" value={counts.customRoles}
            hint={ent && !ent.customRoles ? `Not included in ${license?.planName}` : undefined} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="grid content-start gap-6 lg:col-span-3">
          {steps.length > 1 && steps.some((s) => !s.done) && <SetupChecklist steps={steps} />}
          {activity && <ActivityFeed items={activity} />}
          {!activity && <ComingNext />}
        </div>
        <div className="grid content-start gap-6 lg:col-span-2">
          {activity && <ComingNext />}
          <Card className="motion-safe:animate-rise p-5 [animation-delay:480ms] sm:p-6">
            <h2 className="text-base font-semibold">Your access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re <span className="font-medium text-foreground">{ctx.roleName}</span> in {ctx.organization.name}. What you can see and change is checked on the server for every request.
            </p>
            {canSeeMembers && (
              <Link href={`${base}/settings/roles`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                See what each role can do <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-52 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
      <div className="grid gap-6 lg:grid-cols-5"><Skeleton className="h-64 lg:col-span-3" /><Skeleton className="h-64 lg:col-span-2" /></div>
    </div>
  );
}

export default function WorkspaceHome({ params }: PageProps<"/[organizationSlug]">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview params={params} />
    </Suspense>
  );
}
