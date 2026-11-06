import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, MailPlus, ShieldCheck, Users } from "lucide-react";
import { db } from "@/server/database/client";
import { can } from "@/server/tenancy/context";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

async function Overview({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { user, ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}`;
  const canSeeMembers = can(ctx, "organization.members.read");
  const [members, pending, customRoles] = canSeeMembers
    ? await Promise.all([
        db.organizationMember.count({ where: { organizationId: ctx.organizationId, status: "active" } }),
        db.invitation.count({ where: { organizationId: ctx.organizationId, status: "pending", expiresAt: { gt: new Date() } } }),
        db.role.count({ where: { organizationId: ctx.organizationId } }),
      ])
    : [null, null, null];

  const tiles = [
    { href: `${base}/settings/members`, icon: Users, label: "Active members", value: members, show: canSeeMembers },
    { href: `${base}/settings/members`, icon: MailPlus, label: "Pending invitations", value: pending, show: canSeeMembers },
    { href: `${base}/settings/roles`, icon: ShieldCheck, label: "Custom roles", value: customRoles, show: canSeeMembers },
  ].filter((t) => t.show);

  return (
    <div className="grid gap-8">
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description={<>You&apos;re signed in to <span className="font-medium text-foreground">{ctx.organization.name}</span> as {ctx.roleName}.</>}
      />
      {tiles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="group rounded-lg focus-visible:ring-2">
              <Card className="flex items-center gap-4 p-5 transition-colors group-hover:border-primary/40">
                <span className="flex size-10 items-center justify-center rounded-md bg-primary-subtle text-primary"><t.icon className="size-5" aria-hidden /></span>
                <span className="grid">
                  <span className="text-2xl font-semibold tabular-nums">{t.value}</span>
                  <span className="text-[13px] text-muted-foreground">{t.label}</span>
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Card className="p-6">
        <h2 className="text-base font-semibold">Business modules are on the way</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          This release covers your organization, team access and roles. People, CRM, Projects and Time — and the dashboard that connects them — arrive in the next milestones. Nothing here is simulated: every number above comes from your organization&apos;s records.
        </p>
        {can(ctx, "organization.members.invite") && (
          <Link href={`${base}/settings/members`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Invite your team <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </Card>
    </div>
  );
}

export default function WorkspaceHome({ params }: PageProps<"/[organizationSlug]">) {
  return (
    <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-8 w-72" /><div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div></div>}>
      <Overview params={params} />
    </Suspense>
  );
}
