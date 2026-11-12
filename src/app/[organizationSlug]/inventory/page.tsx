import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ArrowUpRight, Boxes, MapPin, PackagePlus, Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getInventoryOverview, listMovements, listProducts } from "@/server/inventory/inventory";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LocationDialog, MovementBadge, MovementDialog, ProductDialog } from "@/modules/inventory/inventory-ui";
import { qty } from "@/modules/inventory/format";
import { movementOptions } from "@/modules/inventory/options";
import { money } from "@/modules/crm/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inventory" };

const when = (d: Date, tz: string) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

async function Overview({ params }: PageProps<"/[organizationSlug]/inventory">) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "inventory.read")) return <PermissionDenied what="inventory" />;
  const slug = ctx.organization.slug;
  const base = `/${slug}/inventory`;
  const c = ctx.organization.currency;
  const manage = can(ctx, "inventory.manage");
  const [o, low, recent, opts] = await Promise.all([getInventoryOverview(ctx), listProducts(ctx, { low: true }), listMovements(ctx, { limit: 8 }), movementOptions(ctx)]);
  const maxDay = Math.max(1, ...o.daily.flatMap((d) => [d.in, d.out]));
  const setup = o.locations === 0 || o.products === 0;

  const actions = manage ? (
    <div className="flex flex-wrap gap-2">
      <MovementDialog slug={slug} products={opts.products} locations={opts.locations} trigger={<Button disabled={setup}><PackagePlus />Record stock</Button>} />
      <ProductDialog slug={slug} currency={c} trigger={<Button variant="secondary"><Plus />New product</Button>} />
    </div>
  ) : undefined;

  const kpis = [
    { label: "Stock value (cost)", value: money(o.value, c), sub: `${money(o.retailValue, c)} at sale prices` },
    { label: "Products", value: o.products.toLocaleString("en-US"), sub: `${qty(o.units)} units across ${o.locations} location${o.locations === 1 ? "" : "s"}`, href: `${base}/products` },
    { label: "Low stock", value: String(o.low), sub: "at or below reorder level", href: `${base}/products?stock=low`, warn: o.low > 0 },
    { label: "Out of stock", value: String(o.out), sub: "nothing on hand", href: `${base}/products?stock=out`, danger: o.out > 0 },
  ];

  return (
    <>
      <PageHeader title="Inventory" description={`What you have, where it is, and every movement in and out. Values in ${c}.`} actions={actions} />

      {setup && manage && (
        <Card className="motion-safe:animate-rise grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-semibold">Set up inventory in two steps</p>
            <ol className="mt-1 list-decimal pl-5 text-sm text-muted-foreground">
              <li className={cn(o.locations > 0 && "line-through")}>Add a location: a warehouse, shop or shelf.</li>
              <li className={cn(o.products > 0 && "line-through")}>Add your products, then record the stock you have.</li>
            </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            {o.locations === 0 && <LocationDialog slug={slug} trigger={<Button><MapPin />Add location</Button>} />}
            {o.products === 0 && <ProductDialog slug={slug} currency={c} trigger={<Button variant={o.locations === 0 ? "secondary" : "primary"}><Plus />Add product</Button>} />}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => {
          const body = (
            <Card className={cn("motion-safe:animate-rise h-full p-4 transition-colors", k.href && "hover:border-primary/40")} style={{ animationDelay: `${i * 50}ms` }}>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={cn("mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl", k.warn && "text-warning", k.danger && "text-danger")}>{k.value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{k.sub}</p>
            </Card>
          );
          return k.href ? <Link key={k.label} href={k.href} className="block rounded-xl">{body}</Link> : <div key={k.label}>{body}</div>;
        })}
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="motion-safe:animate-rise min-w-0 p-5 [animation-delay:160ms] sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Stock in and out</h2>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" aria-hidden />In</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted-foreground/40" aria-hidden />Out</span>
            </div>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">Units received and issued, last 14 days. Last 30 days: {qty(o.in30)} in, {qty(o.out30)} out.</p>
          <div className="mt-6 grid h-44 grid-cols-14 items-end gap-1 sm:gap-2" role="list" aria-label="Units in and out by day">
            {o.daily.map((d, i) => (
              <div key={d.day} role="listitem" className="grid h-full grid-rows-[1fr_auto] gap-2" aria-label={`${d.day}: ${qty(d.in)} in, ${qty(d.out)} out`}>
                <div className="flex items-end justify-center gap-0.5">
                  <div title={`${qty(d.in)} in`} className="w-1/2 max-w-3 origin-bottom rounded-t bg-primary motion-safe:animate-grow-y" style={{ height: `${Math.max(d.in ? 3 : 0, (d.in / maxDay) * 100)}%`, animationDelay: `${200 + i * 30}ms` }} />
                  <div title={`${qty(d.out)} out`} className="w-1/2 max-w-3 origin-bottom rounded-t bg-muted-foreground/40 motion-safe:animate-grow-y" style={{ height: `${Math.max(d.out ? 3 : 0, (d.out / maxDay) * 100)}%`, animationDelay: `${220 + i * 30}ms` }} />
                </div>
                <span className="text-center text-[10px] text-muted-foreground">{Number(d.day.slice(8))}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="motion-safe:animate-rise overflow-hidden [animation-delay:200ms]">
          <div className="flex items-center justify-between gap-2 px-5 pt-5">
            <h2 className="text-base font-semibold">Needs reordering</h2>
            {low.length > 0 && <Link href={`${base}/products?stock=low`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">See all</Link>}
          </div>
          {low.length === 0 ? <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground">Nothing is at or below its reorder level.</p> : (
            <ul className="mt-2 divide-y divide-border">
              {low.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`${base}/products/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted/50">
                    <AlertTriangle className={cn("size-4 shrink-0", p.onHand === 0 ? "text-danger" : "text-warning")} aria-hidden />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.name}</span><span className="block text-xs text-muted-foreground">Reorder at {qty(p.reorderLevel)} {p.unit}</span></span>
                    <span className="text-sm font-semibold tabular-nums">{qty(p.onHand)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="motion-safe:animate-rise overflow-hidden [animation-delay:240ms]">
        <div className="flex items-center justify-between gap-2 px-5 pt-5">
          <h2 className="text-base font-semibold">Recent movements</h2>
          <Link href={`${base}/movements`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">All movements<ArrowUpRight className="size-3.5" aria-hidden /></Link>
        </div>
        {recent.length === 0 ? <EmptyState icon={Boxes} title="No movements yet" description={manage ? "Use “Record stock” to add what you have on hand." : "Stock changes appear here."} /> : (
          <ul className="mt-2 divide-y divide-border">
            {recent.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <MovementBadge kind={m.kind} />
                <Link href={`${base}/products/${m.product.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{m.product.name}</Link>
                <span className="text-xs text-muted-foreground">{m.location.name} · {when(m.createdAt, ctx.organization.timezone)}</span>
                <span className={cn("w-20 text-right font-semibold tabular-nums", m.quantity > 0 ? "text-success" : "text-foreground")}>{m.quantity > 0 ? "+" : ""}{qty(m.quantity)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function InventoryPage(props: PageProps<"/[organizationSlug]/inventory">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-10 w-48" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>}><Overview {...props} /></Suspense>;
}
