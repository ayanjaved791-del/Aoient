import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listStages } from "@/server/crm/deals";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StageDialog } from "@/modules/crm/forms";
import { StageList } from "@/modules/crm/stage-list";

export const metadata: Metadata = { title: "Pipeline settings" };

async function Settings({ params }: PageProps<"/[organizationSlug]/crm/settings">) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "crm.pipeline.manage")) return <PermissionDenied what="pipeline settings" />;
  const stages = await listStages(ctx);
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader title="Pipeline settings" description="The stages every deal moves through. Won and lost stages close a deal."
        actions={<StageDialog slug={ctx.organization.slug} trigger={<Button><Plus />New stage</Button>} />} />
      <Card className="overflow-hidden">
        <StageList slug={ctx.organization.slug} stages={stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind, probability: s.probability, dealCount: s.dealCount }))} />
      </Card>
      <p className="text-xs text-muted-foreground">A stage can be deleted once no deals are in it. The pipeline always keeps at least one open stage.</p>
    </div>
  );
}

export default function SettingsPage(props: PageProps<"/[organizationSlug]/crm/settings">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-56" /><Skeleton className="h-80" /></div>}><Settings {...props} /></Suspense>;
}
