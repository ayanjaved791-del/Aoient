import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getDb } from "@/server/database/client";
import { PeopleNav } from "@/modules/people/people-nav";

async function Nav({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}/people`;
  const approver = can(ctx, "people.leave.approve");
  const pending = approver
    ? (await getDb()<{ n: number }[]>`select count(*)::int as n from leave_request where organization_id = ${ctx.organizationId} and status = 'pending'`)[0].n
    : null;
  const items = [
    ...(can(ctx, "people.employee.read") ? [{ href: base, label: "Directory", exact: true }, { href: `${base}/departments`, label: "Departments" }] : []),
    ...(can(ctx, "people.leave.request") || approver ? [{ href: `${base}/leave`, label: "Leave", badge: pending }] : []),
    ...(can(ctx, "people.attendance.own") || can(ctx, "people.attendance.manage") ? [{ href: `${base}/attendance`, label: "Attendance" }] : []),
  ];
  return items.length > 1 ? <PeopleNav items={items} /> : null;
}

export default function PeopleLayout({ children, params }: LayoutProps<"/[organizationSlug]/people">) {
  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <Suspense fallback={<div className="h-11 border-b border-border" />}><Nav params={params} /></Suspense>
      {children}
    </div>
  );
}
