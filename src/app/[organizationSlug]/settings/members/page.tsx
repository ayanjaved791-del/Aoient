import type { Metadata } from "next";
import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getMembersView } from "@/server/organizations/views";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Skeleton } from "@/components/ui/skeleton";
import { InviteMemberDialog } from "@/modules/organization/invite-member-dialog";
import { MembersTable } from "@/modules/organization/members-table";
import { PendingInvitations } from "@/modules/organization/pending-invitations";

export const metadata: Metadata = { title: "Members" };

type Props = PageProps<"/[organizationSlug]/settings/members">;

async function Content({ params, searchParams }: Props) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "organization.members.read")) return <PermissionDenied what="members" />;

  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const status = sp.status === "active" || sp.status === "suspended" ? sp.status : undefined;
  const view = await getMembersView(ctx, { query, status });
  const slug = ctx.organization.slug;
  const defaultRole = view.grantableRoles.find((r) => r.name === "Employee")?.id;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Members"
        description={`${view.total} ${view.total === 1 ? "person has" : "people have"} access to ${ctx.organization.name}.`}
        actions={view.canInvite ? <InviteMemberDialog slug={slug} roles={view.grantableRoles} defaultRoleId={defaultRole} /> : undefined}
      />
      <PendingInvitations
        slug={slug}
        canRevoke={can(ctx, "organization.members.invite")}
        invitations={view.invitations.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() }))}
      />
      <MembersTable
        slug={slug}
        filtered={Boolean(query || status)}
        roles={view.grantableRoles}
        members={view.members.map((m) => ({
          id: m.id, name: m.name, email: m.email, status: m.status, joinedAt: m.joinedAt.toISOString(),
          role: { id: m.role.id, name: m.role.name }, isSelf: m.isSelf, canManage: m.canManage, canRemove: m.canRemove,
        }))}
      />
    </div>
  );
}

export default function MembersPage(props: Props) {
  return (
    <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-full" /><Skeleton className="h-64 w-full" /></div>}>
      <Content {...props} />
    </Suspense>
  );
}
