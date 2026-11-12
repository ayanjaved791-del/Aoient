/**
 * Inventory: products, locations, stock movements that can't go below zero,
 * transfers, counts, permissions and cross-organization isolation.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase } from "../support/db";
import {
  createLocation, createProduct, getInventoryOverview, getProduct, listLocations, listMovements, listProducts, recordMovement,
  setLocationArchived, setProductArchived, transferStock, updateProduct,
} from "@/server/inventory/inventory";

async function setup(slug: string) {
  const { org, ctx } = await createOrgWithOwner(slug);
  const shop = await createLocation(ctx, { name: "Shop" });
  const store = await createLocation(ctx, { name: "Back store" });
  const tea = await createProduct(ctx, { sku: "TEA-1", name: "Green tea", unit: "box", costPrice: "4.50", salePrice: 9, reorderLevel: 5 });
  return { org, ctx, shop, store, tea };
}

describe("inventory", () => {
  beforeEach(resetDatabase);

  it("receives, issues, counts and transfers stock, and keeps a running balance", async () => {
    const { ctx, shop, store, tea } = await setup("inv-flow");
    expect((await recordMovement(ctx, { kind: "receive", productId: tea.id, locationId: store.id, quantity: 20, unitCost: 4.5, reference: "PO-7" })).balance).toBe(20);
    expect((await recordMovement(ctx, { kind: "issue", productId: tea.id, locationId: store.id, quantity: "3" })).balance).toBe(17);
    expect(await transferStock(ctx, { productId: tea.id, fromLocationId: store.id, toLocationId: shop.id, quantity: 10 })).toEqual({ from: 7, to: 10 });
    // A count that finds 9 instead of 10 records a -1 adjustment; a matching count changes nothing.
    expect(await recordMovement(ctx, { kind: "count", productId: tea.id, locationId: shop.id, counted: 9 })).toMatchObject({ balance: 9 });
    expect(await recordMovement(ctx, { kind: "count", productId: tea.id, locationId: shop.id, counted: 9 })).toEqual({ id: null, balance: 9 });

    const p = await getProduct(ctx, tea.id);
    expect(p.onHand).toBe(16);
    expect(p.value).toBe(72);
    expect(Object.fromEntries(p.stock.map((s) => [s.location, s.quantity]))).toEqual({ Shop: 9, "Back store": 7 });
    expect(p.movements.map((m) => [m.kind, m.quantity, m.balanceAfter])).toEqual([
      ["adjust", -1, 9], ["transfer_in", 10, 10], ["transfer_out", -10, 7], ["issue", -3, 17], ["receive", 20, 20],
    ]);
    const o = await getInventoryOverview(ctx);
    expect(o).toMatchObject({ products: 1, units: 16, value: 72, retailValue: 144, low: 0, out: 0, locations: 2, in30: 20, out30: 3 });
    expect(o.daily).toHaveLength(14);
    expect((await listLocations(ctx)).find((l) => l.name === "Shop")).toMatchObject({ products: 1, units: 9 });
    expect(await listMovements(ctx, { kind: "transfer" })).toHaveLength(2);
  });

  it("never lets stock go below zero, and flags low stock", async () => {
    const { ctx, shop, store, tea } = await setup("inv-neg");
    await recordMovement(ctx, { kind: "receive", productId: tea.id, locationId: shop.id, quantity: 4 });
    await expect(recordMovement(ctx, { kind: "issue", productId: tea.id, locationId: shop.id, quantity: 5 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(transferStock(ctx, { productId: tea.id, fromLocationId: store.id, toLocationId: shop.id, quantity: 1 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(transferStock(ctx, { productId: tea.id, fromLocationId: shop.id, toLocationId: shop.id, quantity: 1 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(recordMovement(ctx, { kind: "count", productId: tea.id, locationId: shop.id, counted: -1 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    // Two issues at once for the whole stock: exactly one wins.
    const results = await Promise.allSettled([1, 2].map(() => recordMovement(ctx, { kind: "issue", productId: tea.id, locationId: shop.id, quantity: 4 })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getProduct(ctx, tea.id)).onHand).toBe(0);
    // The database refuses negative stock even if the application didn't check.
    await expect(db()`update inventory_stock set quantity = -1 where product_id = ${tea.id}`).rejects.toThrow();
    await recordMovement(ctx, { kind: "receive", productId: tea.id, locationId: shop.id, quantity: 5 });
    expect((await listProducts(ctx, { low: true })).map((p) => p.name)).toEqual(["Green tea"]);
    expect((await getInventoryOverview(ctx)).low).toBe(1);
  });

  it("keeps SKUs unique, protects archived records and non-empty locations", async () => {
    const { ctx, shop, store, tea } = await setup("inv-rules");
    await expect(createProduct(ctx, { sku: "tea-1", name: "Duplicate" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createProduct(ctx, { sku: "bad sku!", name: "Bad" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await updateProduct(ctx, tea.id, { sku: "TEA-1", name: "Green tea (50)", unit: "box", costPrice: 5, salePrice: 10, reorderLevel: 2 });
    expect((await getProduct(ctx, tea.id)).name).toBe("Green tea (50)");
    await recordMovement(ctx, { kind: "receive", productId: tea.id, locationId: shop.id, quantity: 1 });
    await expect(setLocationArchived(ctx, shop.id, true)).rejects.toMatchObject({ code: "CONFLICT" });
    await setLocationArchived(ctx, store.id, true);
    await expect(recordMovement(ctx, { kind: "receive", productId: tea.id, locationId: store.id, quantity: 1 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await setProductArchived(ctx, tea.id, true);
    await expect(recordMovement(ctx, { kind: "receive", productId: tea.id, locationId: shop.id, quantity: 1 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await listProducts(ctx)).toEqual([]);
    expect((await listProducts(ctx, { archived: true })).map((p) => p.sku)).toEqual(["TEA-1"]);
  });

  it("lets only inventory roles in: employees can't see it, finance managers can manage it", async () => {
    const { org, ctx, shop, tea } = await setup("inv-roles");
    const emp = await addMember(org.id, "employee");
    const fin = await addMember(org.id, "finance_manager");
    await expect(listProducts(emp.ctx)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getInventoryOverview(emp.ctx)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(recordMovement(emp.ctx, { kind: "receive", productId: tea.id, locationId: shop.id, quantity: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createProduct(emp.ctx, { sku: "X1", name: "Nope" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await recordMovement(fin.ctx, { kind: "receive", productId: tea.id, locationId: shop.id, quantity: 2 });
    expect((await listProducts(fin.ctx))[0].onHand).toBe(2);
    expect((await listMovements(ctx))[0].by).not.toBeUndefined();
    void ctx;
  });

  it("never reads or moves another organization's stock", async () => {
    const a = await setup("inv-a");
    const b = await setup("inv-b");
    await recordMovement(b.ctx, { kind: "receive", productId: b.tea.id, locationId: b.shop.id, quantity: 8 });
    await expect(getProduct(a.ctx, b.tea.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Another org's product or location ids are refused as if they didn't exist.
    for (const run of [
      () => recordMovement(a.ctx, { kind: "issue", productId: b.tea.id, locationId: b.shop.id, quantity: 1 }),
      () => recordMovement(a.ctx, { kind: "receive", productId: a.tea.id, locationId: b.shop.id, quantity: 1 }),
      () => transferStock(a.ctx, { productId: b.tea.id, fromLocationId: b.shop.id, toLocationId: a.shop.id, quantity: 1 }),
      () => updateProduct(a.ctx, b.tea.id, { sku: "HACK", name: "Hacked" }),
      () => setProductArchived(a.ctx, b.tea.id, true),
      () => setLocationArchived(a.ctx, b.store.id, true),
    ]) {
      await expect(run()).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND|VALIDATION_ERROR/) });
    }
    expect(await listMovements(a.ctx, { productId: b.tea.id })).toEqual([]);
    expect((await listProducts(a.ctx)).every((p) => p.onHand === 0)).toBe(true);
    expect((await getProduct(b.ctx, b.tea.id))).toMatchObject({ onHand: 8, name: "Green tea" });
    // The database refuses a cross-organization stock row outright.
    await expect(db()`insert into inventory_stock (organization_id, product_id, location_id, quantity) values (${a.org.id}, ${b.tea.id}, ${a.shop.id}, 1)`).rejects.toThrow();
  });
});
