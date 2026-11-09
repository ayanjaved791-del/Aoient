import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { avatarUrl, orgLogoUrl } from "@/lib/media";
import { UserMenu } from "@/components/layout/user-menu";
import { AppSidebar, MobileNav, type SidebarGroup } from "@/components/layout/app-sidebar";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { listUserOrganizations } from "@/server/organizations/organizations";
import { getLicenseOverview, type License } from "@/server/billing/license";
import { can, type OrgContext } from "@/server/tenancy/context";
import { LicenseBanner, licenseLabel } from "@/modules/billing/license-view";
import { TRIAL_DAYS, daysLeft } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";
import { AssistantPanel } from "@/modules/assistant/assistant-panel";
import { LiveSync } from "@/components/live/live-sync";
import { assistantScope, suggestionsFor } from "@/server/assistant/answer";

/** Only pages the member can open are linked; each page still re-checks on the server. */
function sidebarGroups(ctx: OrgContext, base: string): SidebarGroup[] {
  const team: SidebarGroup["links"] = can(ctx, "organization.members.read")
    ? [
        { href: `${base}/settings/members`, label: "Members", icon: "members" },
        { href: `${base}/settings/roles`, label: "Roles & permissions", icon: "roles" },
      ]
    : [];
  const org: SidebarGroup["links"] = [
    // Read-only settings aren't useful to people who can't change them.
    ...(can(ctx, "organization.update") ? [{ href: `${base}/settings/general`, label: "General", icon: "general" as const }] : []),
    ...(can(ctx, "billing.read") ? [{ href: `${base}/settings/billing`, label: "Billing & plan", icon: "billing" as const }] : []),
  ];
  const people: SidebarGroup["links"] = [
    ...(can(ctx, "people.employee.read") ? [
      { href: `${base}/people`, label: "Directory", icon: "people" as const, exact: true },
      { href: `${base}/people/departments`, label: "Departments", icon: "departments" as const },
    ] : []),
    ...(can(ctx, "people.leave.request") || can(ctx, "people.leave.approve") ? [{ href: `${base}/people/leave`, label: "Leave", icon: "leave" as const }] : []),
  ];
  const crm: SidebarGroup["links"] = [
    ...(can(ctx, "crm.deal.read") ? [{ href: `${base}/crm`, label: "Pipeline", icon: "pipeline" as const, exact: true }] : []),
    ...(can(ctx, "crm.lead.read") ? [{ href: `${base}/crm/leads`, label: "Leads", icon: "leads" as const }] : []),
    ...(can(ctx, "crm.contact.read") ? [
      { href: `${base}/crm/contacts`, label: "Contacts", icon: "contacts" as const },
      { href: `${base}/crm/companies`, label: "Companies", icon: "companies" as const },
    ] : []),
    ...(can(ctx, "crm.report.read") ? [{ href: `${base}/crm/reports`, label: "Sales reports", icon: "reports" as const }] : []),
  ];
  return [
    { links: [{ href: base, label: "Dashboard", icon: "overview", exact: true }] },
    ...(people.length ? [{ label: "People", links: people }] : []),
    ...(crm.length ? [{ label: "CRM", links: crm }] : []),
    ...(team.length ? [{ label: "Team", links: team }] : []),
    ...(org.length ? [{ label: "Organization", links: org }] : []),
  ];
}

const TONE = {
  success: "text-success",
  primary: "text-primary",
  warning: "text-warning",
  danger: "text-danger",
} as const;

function PlanCard({ license, href }: { license: License | null; href: string | null }) {
  const label = licenseLabel(license);
  const appTrial = license?.state === "trial" && license.source === "trial";
  const left = appTrial ? daysLeft(license.trialEndsAt) : null;
  const pct = left === null ? null : Math.min(100, Math.max(4, Math.round((left / TRIAL_DAYS) * 100)));
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
        <span className="grid min-w-0 leading-tight">
          <span className="truncate text-sm font-semibold">{license ? `${license.planName} plan` : "No plan"}</span>
          <span className={cn("truncate text-xs font-medium", TONE[label.tone])}>{label.text}</span>
        </span>
      </div>
      {pct !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Trial days left" aria-valuemin={0} aria-valuemax={TRIAL_DAYS} aria-valuenow={left ?? 0}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-xl border border-border bg-surface-muted/60 p-3 transition-colors hover:border-primary/40 hover:bg-surface-muted">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-border bg-surface-muted/60 p-3">{body}</div>
  );
}

async function WorkspaceFrame({ params, children }: { params: Promise<{ organizationSlug: string }>; children: React.ReactNode }) {
  const { organizationSlug } = await params;
  const { user, ctx } = await getPageOrgContext(organizationSlug);
  const [orgs, { license }] = await Promise.all([listUserOrganizations(user.id), getLicenseOverview(ctx.organizationId)]);
  const base = `/${ctx.organization.slug}`;
  const groups = sidebarGroups(ctx, base);
  const switcher = <OrgSwitcher current={{ slug: ctx.organization.slug, name: ctx.organization.name, roleName: ctx.roleName, logoUrl: orgLogoUrl(ctx.organizationId, ctx.organization.logoUpdatedAt) }} organizations={orgs} />;
  const top = (
    <>
      <Link href={base} aria-label="Workspace home" className="shrink-0"><Logo withWordmark={false} /></Link>
      <span className="text-border" aria-hidden>/</span>
      <div className="min-w-0 flex-1">{switcher}</div>
    </>
  );
  // Plan details are for people who see billing or add seats; everyone is told when the workspace is read-only.
  const seesPlan = can(ctx, "billing.read") || can(ctx, "organization.members.invite");
  const readOnly = !license || license.state === "expired";
  const bottom = seesPlan ? <PlanCard license={license} href={can(ctx, "billing.read") ? `${base}/settings/billing` : null} /> : null;

  return (
    <div className="flex min-h-dvh">
      <AppSidebar groups={groups} top={top} bottom={bottom} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
          <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <MobileNav groups={groups} top={top} bottom={bottom} />
            <div className="min-w-0 lg:hidden">{switcher}</div>
            <p className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">
              <span className="font-medium text-foreground">{ctx.organization.name}</span>
              <span className="mx-1.5 text-border">·</span>
              {ctx.roleName}
            </p>
            {readOnly && (
              <span className="hidden shrink-0 rounded-full border border-danger/30 bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger sm:inline-flex" title="The plan has ended: you can view everything but not make changes.">
                Read-only
              </span>
            )}
            <div className="ml-auto"><UserMenu name={user.name} email={user.email} avatarUrl={avatarUrl(user.id, user.avatarUpdatedAt)} /></div>
          </div>
        </header>
        {(seesPlan || readOnly) && <LicenseBanner slug={ctx.organization.slug} license={license} canManage={can(ctx, "billing.manage")} />}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        <LiveSync slug={ctx.organization.slug} />
        <AssistantPanel slug={ctx.organization.slug} organizationName={ctx.organization.name} roleName={ctx.roleName}
          suggestions={suggestionsFor(ctx).slice(0, 6)} fullAccess={assistantScope(ctx).team} />
      </div>
    </div>
  );
}

function FrameSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-64 shrink-0 border-r border-border bg-sidebar lg:block" />
      <div className="flex-1">
        <div className="h-14 border-b border-border bg-surface" />
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:px-6 lg:px-8"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>
      </div>
    </div>
  );
}

export default function WorkspaceLayout({ children, params }: LayoutProps<"/[organizationSlug]">) {
  return (
    <Suspense fallback={<FrameSkeleton />}>
      <WorkspaceFrame params={params}>{children}</WorkspaceFrame>
    </Suspense>
  );
}
