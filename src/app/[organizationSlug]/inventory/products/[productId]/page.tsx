import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowLeftRight, ClipboardList, PackageMinus, PackagePlus, Pencil } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getProduct } from "@/server/inventory/inventory";
import { isAppError } from "@/lib/errors";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MovementBadge, MovementDialog, ProductArchiveButton, ProductDialog, StockBadge } from "@/modules/inventory/inventory-ui";
import { qty } from "@/modules/inventory/format";
import { movementOptions } from "@/modules/inventory/options";
import { money } from "@/modules/crm/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Product" };

const when = (d: Date, tz: string) => d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

async function Product({ params }: PageProps<"/[organizationSlug]/inventory/products/[productId]">) {
  const { organizationSlug, productId } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "inventory.read")) return <PermissionDenied what="inventory" />;
  const p = await getProduct(ctx, productId).catch((e) => { if (isAppError(e) && e.code === "NOT_FOUND") notFound(); throw e; });
  const slug = ctx.organization.slug;
  const base = `/${slug}/inventory`;
  const c = ctx.organization.currency;
  const manage = can(ctx, "inventory.manage") && !p.archived;
  const opts = manage ? await movementOptions(ctx) : null;
  const maxLoc = Math.max(1, ...p.stock.map((s) => s.quantity));
  // Start stock out, counts and transfers at the location holding the most.
  const fullest = p.stock.reduce<{ locationId: string; quantity: number } | null>((best, s) => (s.quantity > (best?.quantity ?? 0) ? s : best), null)?.locationId;
  const margin = p.salePrice > 0 ? Math.round(((p.salePrice - p.costPrice) / p.salePrice) * 100) : null;
  const move = (mode: "receive" | "issue" | "count" | "transfer", label: string, Icon: typeof PackagePlus, variant: "primary" | "secondary" = "secondary") =>
    opts && <MovementDialog slug={slug} products={opts.products} locations={opts.locations} productId={p.id} mode={mode} locationId={mode === "receive" ? undefined : fullest} trigger={<Button variant={variant} size="sm"><Icon />{label}</Button>} />;

  return (
    <>
      <Link href={`${base}/products`} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Products</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
            {p.archived ? <span className="text-xs text-muted-foreground">Archived</span> : <StockBadge onHand={p.onHand} reorderLevel={p.reorderLevel} />}
          </div>
          <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
          {p.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{p.description}</p>}
        </div>
        {can(ctx, "inventory.manage") && (
          <div className="flex flex-wrap gap-2">
            {!p.archived && <ProductDialog slug={slug} currency={c} product={p} trigger={<Button variant="secondary" size="sm"><Pencil />Edit</Button>} />}
            <ProductArchiveButton slug={slug} id={p.id} name={p.name} archived={p.archived} />
          </div>
        )}
      </div>

      {manage && <div className="flex flex-wrap gap-2">{move("receive", "Stock in", PackagePlus, "primary")}{move("issue", "Stock out", PackageMinus)}{move("count", "Count", ClipboardList)}{move("transfer", "Transfer", ArrowLeftRight)}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "On hand", value: `${qty(p.onHand)} ${p.unit}`, sub: p.reorderLevel ? `Reorder at ${qty(p.reorderLevel)}` : "No reorder level" },
          { label: "Stock value", value: money(p.value, c), sub: `at ${money(p.costPrice, c)} cost each` },
          { label: "Sale price", value: money(p.salePrice, c), sub: margin === null ? "No sale price" : `${margin}% margin` },
          { label: "Movements", value: String(p.movements.length), sub: p.movements[0] ? `last ${when(p.movements[0].createdAt, ctx.organization.timezone)}` : "none yet" },
        ].map((k, i) => (
          <Card key={k.label} className="motion-safe:animate-rise p-4" style={{ animationDelay: `${i * 50}ms` }}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 truncate text-xl font-semibold tabular-nums">{k.value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit p-5">
          <h2 className="text-base font-semibold">By location</h2>
          {p.stock.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No locations yet.</p> : (
            <ul className="mt-4 grid gap-3">
              {p.stock.map((s, i) => (
                <li key={s.locationId} className="grid gap-1">
                  <div className="flex justify-between gap-2 text-sm"><span className="truncate">{s.location}</span><span className="font-medium tabular-nums">{qty(s.quantity)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                    {s.quantity > 0 && <div className="h-full origin-left rounded-full bg-primary motion-safe:animate-grow-x" style={{ width: `${(s.quantity / maxLoc) * 100}%`, animationDelay: `${150 + i * 50}ms` }} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <h2 className="px-5 pt-5 text-base font-semibold">History</h2>
          {p.movements.length === 0 ? <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground">No stock has moved yet.</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-surface-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="px-4 py-2 font-medium">When</th><th className="px-4 py-2 font-medium">Movement</th><th className="px-4 py-2 font-medium">Location</th><th className="px-4 py-2 text-right font-medium">Change</th><th className="px-4 py-2 text-right font-medium">Balance</th><th className="hidden px-4 py-2 font-medium md:table-cell">Details</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {p.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{when(m.createdAt, ctx.organization.timezone)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5"><MovementBadge kind={m.kind} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5">{m.location.name}</td>
                      <td className={cn("whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums", m.quantity > 0 && "text-success")}>{m.quantity > 0 ? "+" : ""}{qty(m.quantity)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{qty(m.balanceAfter)}</td>
                      <td className="hidden max-w-72 truncate px-4 py-2.5 text-xs text-muted-foreground md:table-cell">{[m.reference, m.note, m.unitCost !== null ? `${money(m.unitCost, c)} each` : null, m.by ? `by ${m.by}` : null].filter(Boolean).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

export default function ProductPage(props: PageProps<"/[organizationSlug]/inventory/products/[productId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-72" /></div>}><Product {...props} /></Suspense>;
}
