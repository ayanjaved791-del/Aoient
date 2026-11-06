import type { Metadata } from "next";
import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getLicenseOverview } from "@/server/billing/license";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Skeleton } from "@/components/ui/skeleton";
import { LicenseView } from "@/modules/billing/license-view";

export const metadata: Metadata = { title: "Billing & plan" };

async function Content({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "billing.read")) return <PermissionDenied what="billing" />;
  // Scoped by the verified context's organization, never by an ID from the URL.
  const { license, usage } = await getLicenseOverview(ctx.organizationId);
  return <LicenseView slug={ctx.organization.slug} license={license} usage={usage} canManage={can(ctx, "billing.manage")} />;
}

export default function BillingSettingsPage({ params }: PageProps<"/[organizationSlug]/settings/billing">) {
  return (
    <div className="grid gap-6">
      <PageHeader title="Billing & plan" description="Your workspace's plan, its limits and how much of them you use." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content params={params} /></Suspense>
    </div>
  );
}
