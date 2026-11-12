import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { PeopleNav } from "@/modules/people/people-nav";

async function Nav({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "inventory.read")) return null;
  const base = `/${ctx.organization.slug}/inventory`;
  const items = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/products`, label: "Products" },
    { href: `${base}/movements`, label: "Movements" },
    { href: `${base}/locations`, label: "Locations" },
  ];
  return <PeopleNav items={items} label="Inventory" />;
}

export default function InventoryLayout({ children, params }: LayoutProps<"/[organizationSlug]/inventory">) {
  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <Suspense fallback={<div className="h-11 border-b border-border" />}><Nav params={params} /></Suspense>
      {children}
    </div>
  );
}
