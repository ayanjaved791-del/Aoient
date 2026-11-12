import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { History, PackagePlus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listMovements } from "@/server/inventory/inventory";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MovementBadge, MovementDialog } from "@/modules/inventory/inventory-ui";
import { qty } from "@/modules/inventory/format";
import { movementOptions } from "@/modules/inventory/options";
import { money } from "@/modules/crm/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Stock movements" };

const KINDS = [["", "All"], ["receive", "Stock in"], ["issue", "Stock out"], ["adjust", "Counts"], ["transfer", "Transfers"]] as const;
const when = (d: Date, tz: string) => d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

async function Movements({ params, searchParams }: PageProps<"/[organizationSlug]/inventory/movements">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "inventory.read")) return <PermissionDenied what="inventory" />;
  const slug = ctx.organization.slug;
  const base = `/${slug}/inventory`;
  const kind = typeof sp.kind === "string" ? sp.kind : "";
  const [rows, opts] = await Promise.all([listMovements(ctx, { kind, limit: 300 }), can(ctx, "inventory.manage") ? movementOptions(ctx) : null]);
  const tz = ctx.organization.timezone;

  return (
    <>
      <PageHeader title="Movements" description="Every change to stock, newest first. Movements can't be edited; a mistake is fixed with a count." actions={
        opts ? <MovementDialog slug={slug} products={opts.products} locations={opts.locations} trigger={<Button><PackagePlus />Record stock</Button>} /> : undefined
      } />
      <div className="scroll-thin flex gap-2 overflow-x-auto">
        {KINDS.map(([k, label]) => (
          <Link key={k} href={k ? `${base}/movements?kind=${k}` : `${base}/movements`} className={cn("whitespace-nowrap rounded-full border px-3 py-1 text-sm", kind === k ? "border-primary bg-primary-subtle text-primary" : "border-border hover:bg-surface-muted")}>{label}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Card><EmptyState icon={History} title="No movements here" description="Stock in, stock out, counts and transfers appear here." /></Card> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted/50 text-left text-xs text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">Product</th><th className="px-4 py-2.5 font-medium">Movement</th><th className="px-4 py-2.5 font-medium">Location</th><th className="px-4 py-2.5 text-right font-medium">Change</th><th className="px-4 py-2.5 text-right font-medium">Balance</th><th className="hidden px-4 py-2.5 font-medium lg:table-cell">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-muted/40">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{when(m.createdAt, tz)}</td>
                    <td className="max-w-56 px-4 py-2.5"><Link href={`${base}/products/${m.product.id}`} className="block truncate font-medium hover:underline">{m.product.name}</Link><span className="font-mono text-xs text-muted-foreground">{m.product.sku}</span></td>
                    <td className="whitespace-nowrap px-4 py-2.5"><MovementBadge kind={m.kind} /></td>
                    <td className="whitespace-nowrap px-4 py-2.5">{m.location.name}</td>
                    <td className={cn("whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums", m.quantity > 0 && "text-success")}>{m.quantity > 0 ? "+" : ""}{qty(m.quantity)} <span className="font-normal text-muted-foreground">{m.product.unit}</span></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{qty(m.balanceAfter)}</td>
                    <td className="hidden max-w-72 truncate px-4 py-2.5 text-xs text-muted-foreground lg:table-cell">{[m.reference, m.note, m.unitCost !== null ? `${money(m.unitCost, ctx.organization.currency)} each` : null, m.by ? `by ${m.by}` : null].filter(Boolean).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

export default function MovementsPage(props: PageProps<"/[organizationSlug]/inventory/movements">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-80" /></div>}><Movements {...props} /></Suspense>;
}
