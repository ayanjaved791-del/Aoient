import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pencil, Plus, Store } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listVendors } from "@/server/finance/vendors";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ListFilters } from "@/modules/crm/notes-ui";
import { VendorArchiveButton, VendorDialog } from "@/modules/finance/forms";
import { money } from "@/modules/crm/labels";

export const metadata: Metadata = { title: "Vendors" };

async function Vendors({ params, searchParams }: PageProps<"/[organizationSlug]/finance/vendors">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  const canManage = can(ctx, "finance.vendor.manage");
  if (!canManage && !can(ctx, "finance.expense.read") && !can(ctx, "finance.expense.manage") && !can(ctx, "finance.expense.approve")) return <PermissionDenied what="vendors" />;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const archived = sp.archived === "1";
  const vendors = await listVendors(ctx, { archived, query });
  const base = `/${ctx.organization.slug}/finance`;
  const add = canManage ? <VendorDialog slug={ctx.organization.slug} trigger={<Button><Plus />New vendor</Button>} /> : undefined;

  return (
    <>
      <PageHeader title="Vendors" description="Suppliers and services you pay, with what you've spent with each." actions={add} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1"><ListFilters placeholder="Search vendors" /></div>
        <Link href={archived ? `${base}/vendors` : `${base}/vendors?archived=1`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">{archived ? "Show active vendors" : "Show archived"}</Link>
      </div>
      {vendors.length === 0 ? (
        <Card><EmptyState icon={Store} title={query || archived ? "No vendors here" : "No vendors yet"} description={query || archived ? "Try a different search." : "Add the suppliers you pay, then pick them on expenses."} action={!query && !archived ? add : undefined} /></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vendors.map((v, i) => (
            <li key={v.id} className="motion-safe:animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-sm font-semibold">{v.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{v.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{[v.email, v.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-0.5">
                      {!v.archived && <VendorDialog slug={ctx.organization.slug} vendor={v} trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${v.name}`}><Pencil /></Button>} />}
                      <VendorArchiveButton slug={ctx.organization.slug} id={v.id} name={v.name} archived={v.archived} />
                    </div>
                  )}
                </div>
                {v.taxId && <p className="mt-3 text-xs text-muted-foreground">Tax no. {v.taxId}</p>}
                {v.notes && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{v.notes}</p>}
                <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                  <span className="text-xs text-muted-foreground">{v.expenseCount} expense{v.expenseCount === 1 ? "" : "s"}</span>
                  <span className="text-right"><span className="block text-lg font-semibold tabular-nums">{money(v.spent, ctx.organization.currency)}</span><span className="block text-xs text-muted-foreground">approved spend</span></span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function VendorsPage(props: PageProps<"/[organizationSlug]/finance/vendors">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-10" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div></div>}><Vendors {...props} /></Suspense>;
}
