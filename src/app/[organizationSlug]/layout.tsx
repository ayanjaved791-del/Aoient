import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgSwitcher } from "@/components/layout/org-switcher";
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
    ...(can(ctx, "organization.read") ? [{ href: `${base}/settings/general`, label: "General", icon: "general" as const }] : []),
    ...(can(ctx, "billing.read") ? [{ href: `${base}/settings/billing`, label: "Billing & plan", icon: "billing" as const }] : []),
  ];
  return [
    { links: [{ href: base, label: "Dashboard", icon: "overview", exact: true }] },
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
        <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-orange-400 text-white">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
        <span className="grid min-w-0 leading-tight">
          <span className="truncate text-sm font-semibold">{license ? `${license.planName} plan` : "No plan"}</span>
          <span className={cn("truncate text-xs font-medium", TONE[label.tone])}>{label.text}</span>
        </span>
      </div>
      {pct !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Trial days left" aria-valuemin={0} aria-valuemax={TRIAL_DAYS} aria-valuenow={left ?? 0}>
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-orange-400" style={{ width: `${pct}%` }} />
        </div>
      )}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg border border-border bg-surface p-3 transition-colors hover:border-primary/40">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-border bg-surface p-3">{body}</div>
  );
}

async function WorkspaceFrame({ params, children }: { params: Promise<{ organizationSlug: string }>; children: React.ReactNode }) {
  const { organizationSlug } = await params;
  const { user, ctx } = await getPageOrgContext(organizationSlug);
  const [orgs, { license }] = await Promise.all([listUserOrganizations(user.id), getLicenseOverview(ctx.organizationId)]);
  const base = `/${ctx.organization.slug}`;
  const groups = sidebarGroups(ctx, base);
  const switcher = <OrgSwitcher current={{ slug: ctx.organization.slug, name: ctx.organization.name, roleName: ctx.roleName }} organizations={orgs} />;
  const top = (
    <>
      <Link href={base} aria-label="Workspace home" className="shrink-0"><Logo withWordmark={false} /></Link>
      <span className="text-border" aria-hidden>/</span>
      <div className="min-w-0 flex-1">{switcher}</div>
    </>
  );
  const bottom = <PlanCard license={license} href={can(ctx, "billing.read") ? `${base}/settings/billing` : null} />;

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
            <div className="ml-auto"><UserMenu name={user.name} email={user.email} /></div>
          </div>
        </header>
        <LicenseBanner slug={ctx.organization.slug} license={license} canManage={can(ctx, "billing.manage")} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
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
