import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listRoles, permissionCatalogForUi } from "@/server/organizations/roles";
import { isSubsetOf } from "@/server/permissions/evaluator";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RolesList } from "@/modules/organization/roles-list";
import { RoleEditorDialog } from "@/modules/organization/role-editor-dialog";

export const metadata: Metadata = { title: "Roles & permissions" };

async function Content({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "organization.members.read")) return <PermissionDenied what="roles" />;

  const roles = await listRoles(ctx);
  const catalog = permissionCatalogForUi();
  const held = [...ctx.permissions];
  const canManage = can(ctx, "organization.roles.manage");
  const slug = ctx.organization.slug;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Roles & permissions"
        description="System roles cover common responsibilities. Create custom roles for anything else."
        actions={canManage ? <RoleEditorDialog slug={slug} catalog={catalog} heldPermissions={held} trigger={<Button><Plus />Custom role</Button>} /> : undefined}
      />
      <RolesList
        slug={slug}
        catalog={catalog}
        heldPermissions={held}
        canManage={canManage}
        roles={roles.map((r) => ({ ...r, editable: r.id !== ctx.roleId && isSubsetOf(r.permissions, ctx.permissions) }))}
      />
    </div>
  );
}

export default function RolesPage({ params }: PageProps<"/[organizationSlug]/settings/roles">) {
  return (
    <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-8 w-60" /><Skeleton className="h-96 w-full" /></div>}>
      <Content params={params} />
    </Suspense>
  );
}
