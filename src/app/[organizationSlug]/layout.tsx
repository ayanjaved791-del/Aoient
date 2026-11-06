import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { WorkspaceNav } from "@/components/layout/workspace-nav";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { listUserOrganizations } from "@/server/organizations/organizations";

/**
 * Interim workspace frame for M1 (organization administration). The full
 * application shell — grouped sidebar, global search, create menu,
 * notifications — is Milestone M2.
 */
async function WorkspaceFrame({ params, children }: { params: Promise<{ organizationSlug: string }>; children: React.ReactNode }) {
  const { organizationSlug } = await params;
  const { user, ctx } = await getPageOrgContext(organizationSlug);
  const orgs = await listUserOrganizations(user.id);
  const base = `/${ctx.organization.slug}`;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link href={base} aria-label="Workspace home" className="shrink-0"><Logo withWordmark={false} /></Link>
          <span className="text-border" aria-hidden>/</span>
          <OrgSwitcher current={{ slug: ctx.organization.slug, name: ctx.organization.name, roleName: ctx.roleName }} organizations={orgs} />
          <div className="ml-auto"><UserMenu name={user.name} email={user.email} /></div>
        </div>
        <div className="mx-auto max-w-6xl px-2 sm:px-4">
          <WorkspaceNav items={[{ href: base, label: "Overview", exact: true }, { href: `${base}/settings`, label: "Settings" }]} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function FrameSkeleton() {
  return (
    <div className="min-h-dvh">
      <div className="h-[97px] border-b border-border bg-surface" />
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:px-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>
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
