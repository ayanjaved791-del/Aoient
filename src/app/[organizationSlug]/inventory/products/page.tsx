import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Package, PackagePlus, Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listProducts } from "@/server/inventory/inventory";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ListFilters } from "@/modules/crm/notes-ui";
import { MovementDialog, ProductDialog, StockBadge } from "@/modules/inventory/inventory-ui";
import { qty } from "@/modules/inventory/format";
import { movementOptions } from "@/modules/inventory/options";
import { money } from "@/modules/crm/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

async function Products({ params, searchParams }: PageProps<"/[organizationSlug]/inventory/products">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "inventory.read")) return <PermissionDenied what="inventory" />;
  const slug = ctx.organization.slug;
  const base = `/${slug}/inventory`;
  const c = ctx.organization.currency;
  const manage = can(ctx, "inventory.manage");
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const stock = sp.stock === "low" || sp.stock === "out" ? sp.stock : sp.archived === "1" ? "archived" : "all";
  const [all, opts] = await Promise.all([listProducts(ctx, { query, archived: stock === "archived", low: stock === "low" }), manage ? movementOptions(ctx) : null]);
  const rows = stock === "out" ? all.filter((p) => p.onHand === 0) : stock === "low" ? all.filter((p) => p.onHand > 0) : all;
  const totalValue = rows.reduce((s, p) => s + p.value, 0);
  const add = manage ? <ProductDialog slug={slug} currency={c} trigger={<Button><Plus />New product</Button>} /> : undefined;
  const chip = (key: string, label: string, href: string) => (
    <Link href={href} className={cn("whitespace-nowrap rounded-full border px-3 py-1 text-sm", stock === key ? "border-primary bg-primary-subtle text-primary" : "border-border hover:bg-surface-muted")}>{label}</Link>
  );

  return (
    <>
      <PageHeader title="Products" description="Everything you stock, with what's on hand across all locations." actions={
        <div className="flex flex-wrap gap-2">
          {opts && <MovementDialog slug={slug} products={opts.products} locations={opts.locations} trigger={<Button variant="secondary"><PackagePlus />Record stock</Button>} />}
          {add}
        </div>
      } />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1"><ListFilters placeholder="Search by name or SKU" /></div>
        <div className="scroll-thin flex gap-2 overflow-x-auto">
          {chip("all", "All", `${base}/products`)}
          {chip("low", "Low stock", `${base}/products?stock=low`)}
          {chip("out", "Out of stock", `${base}/products?stock=out`)}
          {chip("archived", "Archived", `${base}/products?archived=1`)}
        </div>
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon={Package} title={query || stock !== "all" ? "No products here" : "No products yet"}
          description={query || stock !== "all" ? "Try a different search or filter." : "Add the items you buy, store or sell."} action={!query && stock === "all" ? add : undefined} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">SKU</th>
                  <th className="px-4 py-2.5 text-right font-medium">On hand</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Reorder at</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Sale price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p, i) => (
                  <tr key={p.id} className="motion-safe:animate-rise hover:bg-surface-muted/40" style={{ animationDelay: `${Math.min(i, 15) * 25}ms` }}>
                    <td className="max-w-64 px-4 py-3"><Link href={`${base}/products/${p.id}`} className="block truncate font-medium hover:underline">{p.name}</Link></td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{qty(p.onHand)} <span className="font-normal text-muted-foreground">{p.unit}</span></td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground md:table-cell">{p.reorderLevel ? qty(p.reorderLevel) : "—"}</td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums sm:table-cell">{money(p.salePrice, c)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(p.value, c)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{p.archived ? <span className="text-xs text-muted-foreground">Archived</span> : <StockBadge onHand={p.onHand} reorderLevel={p.reorderLevel} />}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border text-sm">
                <tr><td colSpan={5} className="px-4 py-3 text-muted-foreground">{rows.length} product{rows.length === 1 ? "" : "s"}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{money(totalValue, c)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

export default function ProductsPage(props: PageProps<"/[organizationSlug]/inventory/products">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-10" /><Skeleton className="h-80" /></div>}><Products {...props} /></Suspense>;
}
