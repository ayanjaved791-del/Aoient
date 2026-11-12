import "server-only";
import type { OrgContext } from "@/server/tenancy/context";
import { listLocations, listProducts } from "@/server/inventory/inventory";

/** Products and locations for the "Record stock" dialog. */
export async function movementOptions(ctx: OrgContext) {
  const [products, locations] = await Promise.all([listProducts(ctx), listLocations(ctx)]);
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, sub: `${p.sku} · ${p.onHand.toLocaleString("en-US")} ${p.unit} on hand` })),
    locations: locations.map((l) => ({ id: l.id, name: l.name })),
  };
}
