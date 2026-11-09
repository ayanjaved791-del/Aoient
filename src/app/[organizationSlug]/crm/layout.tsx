import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getDb } from "@/server/database/client";
import { PeopleNav } from "@/modules/people/people-nav";

async function Nav({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}/crm`;
  const newLeads = can(ctx, "crm.lead.read")
    ? (await getDb()<{ n: number }[]>`select count(*)::int as n from crm_lead where organization_id = ${ctx.organizationId} and status = 'new' and archived_at is null`)[0].n
    : null;
  const items = [
    ...(can(ctx, "crm.deal.read") ? [{ href: base, label: "Pipeline", exact: true }] : []),
    ...(can(ctx, "crm.lead.read") ? [{ href: `${base}/leads`, label: "Leads", badge: newLeads }] : []),
    ...(can(ctx, "crm.contact.read") ? [{ href: `${base}/contacts`, label: "Contacts" }, { href: `${base}/companies`, label: "Companies" }] : []),
    ...(can(ctx, "crm.report.read") ? [{ href: `${base}/reports`, label: "Reports" }] : []),
    ...(can(ctx, "crm.pipeline.manage") ? [{ href: `${base}/settings`, label: "Pipeline settings" }] : []),
  ];
  return items.length > 1 ? <PeopleNav items={items} label="CRM" /> : null;
}

export default function CrmLayout({ children, params }: LayoutProps<"/[organizationSlug]/crm">) {
  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <Suspense fallback={<div className="h-11 border-b border-border" />}><Nav params={params} /></Suspense>
      {children}
    </div>
  );
}
