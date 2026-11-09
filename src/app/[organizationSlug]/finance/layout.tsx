import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getDb } from "@/server/database/client";
import { PeopleNav } from "@/modules/people/people-nav";

async function Nav({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}/finance`;
  const seesExpenses = can(ctx, "finance.expense.read") || can(ctx, "finance.expense.manage") || can(ctx, "finance.expense.approve");
  const pending = can(ctx, "finance.expense.approve")
    ? (await getDb()<{ n: number }[]>`select count(*)::int as n from finance_expense where organization_id = ${ctx.organizationId} and status = 'pending'`)[0].n
    : null;
  const items = [
    ...(can(ctx, "finance.report.read") ? [{ href: base, label: "Overview", exact: true }] : []),
    ...(can(ctx, "finance.invoice.read") ? [{ href: `${base}/invoices`, label: "Invoices" }, { href: `${base}/estimates`, label: "Estimates" }] : []),
    ...(seesExpenses ? [{ href: `${base}/expenses`, label: "Expenses", badge: pending }] : []),
    ...(seesExpenses || can(ctx, "finance.vendor.manage") ? [{ href: `${base}/vendors`, label: "Vendors" }] : []),
  ];
  return items.length > 1 ? <div className="print:hidden"><PeopleNav items={items} label="Finance" /></div> : null;
}

export default function FinanceLayout({ children, params }: LayoutProps<"/[organizationSlug]/finance">) {
  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <Suspense fallback={<div className="h-11 border-b border-border" />}><Nav params={params} /></Suspense>
      {children}
    </div>
  );
}
