import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listLocations } from "@/server/inventory/inventory";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LocationArchiveButton, LocationDialog } from "@/modules/inventory/inventory-ui";
import { qty } from "@/modules/inventory/format";
import { money } from "@/modules/crm/labels";

export const metadata: Metadata = { title: "Locations" };

async function Locations({ params, searchParams }: PageProps<"/[organizationSlug]/inventory/locations">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "inventory.read")) return <PermissionDenied what="inventory" />;
  const slug = ctx.organization.slug;
  const manage = can(ctx, "inventory.manage");
  const archived = sp.archived === "1";
  const rows = await listLocations(ctx, { archived });
  const add = manage ? <LocationDialog slug={slug} trigger={<Button><Plus />New location</Button>} /> : undefined;

  return (
    <>
      <PageHeader title="Locations" description="Warehouses, shops and shelves where stock is kept." actions={add} />
      <Link href={archived ? `/${slug}/inventory/locations` : `/${slug}/inventory/locations?archived=1`} className="w-fit text-sm text-muted-foreground hover:text-foreground hover:underline">{archived ? "Show active locations" : "Show archived"}</Link>
      {rows.length === 0 ? (
        <Card><EmptyState icon={MapPin} title={archived ? "No archived locations" : "No locations yet"} description={archived ? undefined : "Add at least one place where you keep stock."} action={archived ? undefined : add} /></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((l, i) => (
            <li key={l.id} className="motion-safe:animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted"><MapPin className="size-4" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.name}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{l.address ?? "No address"}</p>
                  </div>
                  {manage && (
                    <div className="flex shrink-0 gap-0.5">
                      {!l.archived && <LocationDialog slug={slug} location={l} trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${l.name}`}><Pencil /></Button>} />}
                      <LocationArchiveButton slug={slug} id={l.id} name={l.name} archived={l.archived} />
                    </div>
                  )}
                </div>
                <div className="mt-auto grid grid-cols-3 gap-2 pt-5 text-center">
                  <div><p className="text-lg font-semibold tabular-nums">{l.products}</p><p className="text-xs text-muted-foreground">products</p></div>
                  <div><p className="text-lg font-semibold tabular-nums">{qty(l.units)}</p><p className="text-xs text-muted-foreground">units</p></div>
                  <div><p className="truncate text-lg font-semibold tabular-nums">{money(l.value, ctx.organization.currency, true)}</p><p className="text-xs text-muted-foreground">value</p></div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function LocationsPage(props: PageProps<"/[organizationSlug]/inventory/locations">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-10 w-48" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div></div>}><Locations {...props} /></Suspense>;
}
