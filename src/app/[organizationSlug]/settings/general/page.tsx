import type { Metadata } from "next";
import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getOrganization } from "@/server/organizations/organizations";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Skeleton } from "@/components/ui/skeleton";
import { GeneralSettingsForm } from "@/modules/organization/general-settings-form";
import { LeaveOrganization } from "@/modules/organization/leave-organization";
import { OrganizationLogoForm } from "@/modules/organization/logo-form";
import { orgLogoUrl } from "@/lib/media";

export const metadata: Metadata = { title: "General settings" };

async function Content({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "organization.read")) return <PermissionDenied what="organization settings" />;
  const org = await getOrganization(ctx);
  const canEdit = can(ctx, "organization.update");
  return (
    <div className="grid gap-6">
      <OrganizationLogoForm
        slug={org.slug}
        name={org.name}
        currentUrl={orgLogoUrl(ctx.organizationId, ctx.organization.logoUpdatedAt)}
        canEdit={canEdit}
      />
      <GeneralSettingsForm
        slug={org.slug}
        readOnly={!canEdit}
        initial={{ name: org.name, slug: org.slug, timezone: org.timezone, currency: org.currency }}
      />
      <LeaveOrganization slug={org.slug} organizationName={org.name} />
    </div>
  );
}

export default function GeneralSettingsPage({ params }: PageProps<"/[organizationSlug]/settings/general">) {
  return (
    <div className="grid gap-6">
      <PageHeader title="General" description="Your organization's profile and regional defaults." />
      <Suspense fallback={<Skeleton className="h-80 w-full" />}><Content params={params} /></Suspense>
    </div>
  );
}
