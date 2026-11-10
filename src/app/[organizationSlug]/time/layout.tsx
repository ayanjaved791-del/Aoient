import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getDb } from "@/server/database/client";
import { PeopleNav } from "@/modules/people/people-nav";

async function Nav({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}/time`;
  const pending = can(ctx, "time.timesheet.approve")
    ? (await getDb()<{ n: number }[]>`select count(*)::int as n from time_timesheet where organization_id = ${ctx.organizationId} and status = 'submitted'`)[0].n
    : null;
  const items = [
    ...(can(ctx, "time.entry.own") ? [{ href: base, label: "My time", exact: true }] : []),
    ...(can(ctx, "time.timesheet.approve") ? [{ href: `${base}/approvals`, label: "Approvals", badge: pending }] : []),
    ...(can(ctx, "time.entry.read_all") ? [{ href: `${base}/reports`, label: "Reports" }] : []),
  ];
  return items.length > 1 ? <PeopleNav items={items} label="Time" /> : null;
}

export default function TimeLayout({ children, params }: LayoutProps<"/[organizationSlug]/time">) {
  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <Suspense fallback={<div className="h-11 border-b border-border" />}><Nav params={params} /></Suspense>
      {children}
    </div>
  );
}
