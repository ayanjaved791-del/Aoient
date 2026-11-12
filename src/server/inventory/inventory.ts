import "server-only";
import postgres from "postgres";
import { getDb, transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { isUniqueViolation } from "@/server/database/errors";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { locationSchema, movementSchema, productSchema, transferSchema } from "@/lib/validation/inventory";

/**
 * Inventory: products, locations (warehouses, shops, vans…), stock on hand and
 * an append-only movement history. Viewing needs inventory.read; every change
 * needs inventory.manage. Every id from the browser is checked against the
 * verified organization, and another organization's record reads as not found.
 */

export type MovementKind = "receive" | "issue" | "adjust" | "transfer_in" | "transfer_out";

export interface ProductRow {
  id: string; sku: string; name: string; description: string | null; unit: string;
  costPrice: number; salePrice: number; reorderLevel: number; onHand: number; value: number; low: boolean; archived: boolean;
}
export interface LocationRow { id: string; name: string; address: string | null; archived: boolean; products: number; units: number; value: number }
export interface MovementRow {
  id: string; kind: MovementKind; quantity: number; balanceAfter: number; unitCost: number | null; reference: string | null; note: string | null;
  product: { id: string; sku: string; name: string; unit: string }; location: { id: string; name: string }; by: string | null; createdAt: Date;
}

const n = (v: string | number | null) => (v === null ? 0 : Number(v));

type ProductDb = {
  id: string; sku: string; name: string; description: string | null; unit: string; cost_price: string; sale_price: string; reorder_level: string; on_hand: string; archived: boolean;
};
const toProduct = (r: ProductDb): ProductRow => {
  const onHand = n(r.on_hand), reorder = n(r.reorder_level), cost = n(r.cost_price);
  return {
    id: r.id, sku: r.sku, name: r.name, description: r.description, unit: r.unit, costPrice: cost, salePrice: n(r.sale_price), reorderLevel: reorder,
    onHand, value: Math.round(onHand * cost * 100) / 100, low: reorder > 0 && onHand <= reorder, archived: r.archived,
  };
};

export async function listProducts(ctx: OrgContext, opts: { query?: string; archived?: boolean; low?: boolean } = {}): Promise<ProductRow[]> {
  assertPermission(ctx, "inventory.read");
  const sql = getDb();
  const q = opts.query?.trim() ? `%${opts.query.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const rows = await sql<ProductDb[]>`
    select p.id, p.sku, p.name, p.description, p.unit, p.cost_price, p.sale_price, p.reorder_level, p.archived_at is not null as archived,
      coalesce(sum(s.quantity), 0) as on_hand
    from inventory_product p
    left join inventory_stock s on s.product_id = p.id and s.organization_id = p.organization_id
    where p.organization_id = ${ctx.organizationId} and ${opts.archived ? sql`p.archived_at is not null` : sql`p.archived_at is null`}
      ${q ? sql`and (lower(p.name) like ${q} or lower(p.sku) like ${q})` : sql``}
    group by p.id
    ${opts.low ? sql`having p.reorder_level > 0 and coalesce(sum(s.quantity), 0) <= p.reorder_level` : sql``}
    order by lower(p.name)
    limit 2000`;
  return rows.map(toProduct);
}

export async function getProduct(ctx: OrgContext, id: string): Promise<ProductRow & { stock: { locationId: string; location: string; quantity: number }[]; movements: MovementRow[] }> {
  assertPermission(ctx, "inventory.read");
  if (!isUuid(id)) throw new NotFoundError("Product not found");
  const sql = getDb();
  const [row] = await sql<ProductDb[]>`
    select p.id, p.sku, p.name, p.description, p.unit, p.cost_price, p.sale_price, p.reorder_level, p.archived_at is not null as archived,
      coalesce((select sum(quantity) from inventory_stock s where s.product_id = p.id), 0) as on_hand
    from inventory_product p where p.id = ${id} and p.organization_id = ${ctx.organizationId}`;
  if (!row) throw new NotFoundError("Product not found");
  const [stock, movements] = await Promise.all([
    sql<{ location_id: string; name: string; quantity: string }[]>`
      select l.id as location_id, l.name, coalesce(s.quantity, 0) as quantity
      from inventory_location l
      left join inventory_stock s on s.location_id = l.id and s.product_id = ${id}
      where l.organization_id = ${ctx.organizationId} and (l.archived_at is null or coalesce(s.quantity, 0) > 0)
      order by lower(l.name)`,
    listMovements(ctx, { productId: id, limit: 100 }),
  ]);
  return { ...toProduct(row), stock: stock.map((s) => ({ locationId: s.location_id, location: s.name, quantity: n(s.quantity) })), movements };
}

function productConflict(e: unknown): never {
  if (isUniqueViolation(e, "inventory_product_org_sku")) throw new ValidationError("Another product already uses this SKU.", { sku: ["Already used by another product"] });
  throw e;
}

export async function createProduct(ctx: OrgContext, input: unknown): Promise<{ id: string; name: string }> {
  assertPermission(ctx, "inventory.manage");
  const v = parseInput(productSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ id: string }[]>`
      insert into inventory_product (organization_id, sku, name, description, unit, cost_price, sale_price, reorder_level, created_by_id)
      values (${ctx.organizationId}, ${v.sku}, ${v.name}, ${v.description}, ${v.unit}, ${v.costPrice}, ${v.salePrice}, ${v.reorderLevel}, ${ctx.userId})
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "inventory.product_created", targetType: "inventory_product", targetId: row.id, metadata: { name: v.name, sku: v.sku } });
    return { id: row.id, name: v.name };
  }).catch(productConflict);
}

export async function updateProduct(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "inventory.manage");
  const v = parseInput(productSchema, input);
  if (!isUuid(id)) throw new NotFoundError("Product not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const r = await tx`
      update inventory_product set sku = ${v.sku}, name = ${v.name}, description = ${v.description}, unit = ${v.unit}, cost_price = ${v.costPrice},
        sale_price = ${v.salePrice}, reorder_level = ${v.reorderLevel}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    if (r.count === 0) throw new NotFoundError("Product not found");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "inventory.product_updated", targetType: "inventory_product", targetId: id, metadata: { name: v.name, sku: v.sku } });
  }).catch(productConflict);
}

export async function setProductArchived(ctx: OrgContext, id: string, archived: boolean): Promise<void> {
  assertPermission(ctx, "inventory.manage");
  if (!isUuid(id)) throw new NotFoundError("Product not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ name: string }[]>`
      update inventory_product set archived_at = ${archived ? tx`now()` : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId} returning name`;
    if (!row) throw new NotFoundError("Product not found");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: archived ? "inventory.product_archived" : "inventory.product_restored", targetType: "inventory_product", targetId: id, metadata: { name: row.name } });
  });
}

/* ─────────────────────────────── locations ─────────────────────────────── */

export async function listLocations(ctx: OrgContext, opts: { archived?: boolean } = {}): Promise<LocationRow[]> {
  assertPermission(ctx, "inventory.read");
  const sql = getDb();
  const rows = await sql<{ id: string; name: string; address: string | null; archived: boolean; products: number; units: string; value: string }[]>`
    select l.id, l.name, l.address, l.archived_at is not null as archived,
      count(s.product_id) filter (where s.quantity > 0)::int as products, coalesce(sum(s.quantity), 0) as units,
      coalesce(sum(s.quantity * p.cost_price), 0) as value
    from inventory_location l
    left join inventory_stock s on s.location_id = l.id and s.organization_id = l.organization_id
    left join inventory_product p on p.id = s.product_id
    where l.organization_id = ${ctx.organizationId} and ${opts.archived ? sql`l.archived_at is not null` : sql`l.archived_at is null`}
    group by l.id
    order by lower(l.name)`;
  return rows.map((r) => ({ id: r.id, name: r.name, address: r.address, archived: r.archived, products: r.products, units: n(r.units), value: Math.round(n(r.value) * 100) / 100 }));
}

function locationConflict(e: unknown): never {
  if (isUniqueViolation(e, "inventory_location_org_name")) throw new ValidationError("A location with this name already exists.", { name: ["Already used"] });
  throw e;
}

export async function createLocation(ctx: OrgContext, input: unknown): Promise<{ id: string; name: string }> {
  assertPermission(ctx, "inventory.manage");
  const v = parseInput(locationSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ id: string }[]>`
      insert into inventory_location (organization_id, name, address) values (${ctx.organizationId}, ${v.name}, ${v.address}) returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "inventory.location_created", targetType: "inventory_location", targetId: row.id, metadata: { name: v.name } });
    return { id: row.id, name: v.name };
  }).catch(locationConflict);
}

export async function updateLocation(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "inventory.manage");
  const v = parseInput(locationSchema, input);
  if (!isUuid(id)) throw new NotFoundError("Location not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const r = await tx`update inventory_location set name = ${v.name}, address = ${v.address}, updated_at = now() where id = ${id} and organization_id = ${ctx.organizationId}`;
    if (r.count === 0) throw new NotFoundError("Location not found");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "inventory.location_updated", targetType: "inventory_location", targetId: id, metadata: { name: v.name } });
  }).catch(locationConflict);
}

/** A location can only be archived once it's empty, so no stock goes missing from view. */
export async function setLocationArchived(ctx: OrgContext, id: string, archived: boolean): Promise<void> {
  assertPermission(ctx, "inventory.manage");
  if (!isUuid(id)) throw new NotFoundError("Location not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [loc] = await tx<{ name: string }[]>`select name from inventory_location where id = ${id} and organization_id = ${ctx.organizationId} for update`;
    if (!loc) throw new NotFoundError("Location not found");
    if (archived) {
      const [stock] = await tx`select 1 from inventory_stock where location_id = ${id} and quantity > 0 limit 1`;
      if (stock) throw new ConflictError(`${loc.name} still holds stock. Move or issue it first.`);
    }
    await tx`update inventory_location set archived_at = ${archived ? tx`now()` : null}, updated_at = now() where id = ${id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: archived ? "inventory.location_archived" : "inventory.location_restored", targetType: "inventory_location", targetId: id, metadata: { name: loc.name } });
  });
}

/* ─────────────────────────────── movements ─────────────────────────────── */

async function ownProduct(tx: Db, org: string, id: string, field = "productId") {
  const msg = "Pick a valid product";
  if (!isUuid(id)) throw new ValidationError(msg, { [field]: [msg] });
  const [p] = await tx<{ id: string; name: string; unit: string; archived: boolean }[]>`
    select id, name, unit, archived_at is not null as archived from inventory_product where id = ${id} and organization_id = ${org}`;
  if (!p) throw new ValidationError(msg, { [field]: [msg] });
  if (p.archived) throw new ValidationError(`${p.name} is archived. Restore it to move stock.`, { [field]: ["This product is archived"] });
  return p;
}
async function ownLocation(tx: Db, org: string, id: string, field = "locationId") {
  const msg = "Pick a valid location";
  if (!isUuid(id)) throw new ValidationError(msg, { [field]: [msg] });
  const [l] = await tx<{ id: string; name: string; archived: boolean }[]>`
    select id, name, archived_at is not null as archived from inventory_location where id = ${id} and organization_id = ${org}`;
  if (!l) throw new ValidationError(msg, { [field]: [msg] });
  if (l.archived) throw new ValidationError(`${l.name} is archived.`, { [field]: ["This location is archived"] });
  return l;
}

const fmtQty = (q: number, unit: string) => `${Number.isInteger(q) ? q : q.toFixed(2)} ${unit}`;

/**
 * Changes stock at one location by `delta` and logs it. The row lock makes
 * concurrent movements queue up, and the table's check refuses negative stock.
 */
async function applyMovement(tx: Db, ctx: OrgContext, m: {
  productId: string; locationId: string; kind: MovementKind; delta: number; unitCost?: number | null; reference?: string | null; note?: string | null; transferId?: string | null;
}, product: { name: string; unit: string }, location: { name: string }, field = "quantity"): Promise<{ id: string; balance: number }> {
  await tx`
    insert into inventory_stock (organization_id, product_id, location_id, quantity) values (${ctx.organizationId}, ${m.productId}, ${m.locationId}, 0)
    on conflict (product_id, location_id) do nothing`;
  const [cur] = await tx<{ quantity: string }[]>`select quantity from inventory_stock where product_id = ${m.productId} and location_id = ${m.locationId} for update`;
  const before = n(cur.quantity);
  const balance = Math.round((before + m.delta) * 100) / 100;
  if (balance < 0) {
    throw new ValidationError(`Only ${fmtQty(before, product.unit)} of ${product.name} at ${location.name}.`, { [field]: [`Only ${fmtQty(before, product.unit)} in stock here`] });
  }
  await tx`update inventory_stock set quantity = ${balance}, updated_at = now() where product_id = ${m.productId} and location_id = ${m.locationId}`;
  const [row] = await tx<{ id: string }[]>`
    insert into inventory_movement (organization_id, product_id, location_id, kind, quantity, balance_after, unit_cost, reference, note, transfer_id, created_by_id, created_at)
    values (${ctx.organizationId}, ${m.productId}, ${m.locationId}, ${m.kind}, ${m.delta}, ${balance}, ${m.unitCost ?? null}, ${m.reference ?? null}, ${m.note ?? null}, ${m.transferId ?? null}, ${ctx.userId}, clock_timestamp())
    returning id`;
  return { id: row.id, balance };
}

function checkViolation(e: unknown): never {
  if (e instanceof postgres.PostgresError && e.code === "23514") throw new ValidationError("That would leave stock below zero.", { quantity: ["Not enough stock"] });
  throw e;
}

/** Receive stock, issue it, or record a count that sets the quantity on hand. */
export async function recordMovement(ctx: OrgContext, input: unknown): Promise<{ id: string | null; balance: number }> {
  assertPermission(ctx, "inventory.manage");
  const v = parseInput(movementSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const product = await ownProduct(tx, ctx.organizationId, v.productId);
    const location = await ownLocation(tx, ctx.organizationId, v.locationId);
    let res: { id: string | null; balance: number };
    if (v.kind === "count") {
      const [cur] = await tx<{ quantity: string }[]>`select quantity from inventory_stock where product_id = ${v.productId} and location_id = ${v.locationId} for update`;
      const delta = Math.round((v.counted - n(cur?.quantity ?? 0)) * 100) / 100;
      // A count that matches what we already had changes nothing.
      if (delta === 0) return { id: null, balance: v.counted };
      res = await applyMovement(tx, ctx, { productId: v.productId, locationId: v.locationId, kind: "adjust", delta, reference: v.reference, note: v.note }, product, location, "counted");
    } else if (v.kind === "receive") {
      res = await applyMovement(tx, ctx, { productId: v.productId, locationId: v.locationId, kind: "receive", delta: v.quantity, unitCost: v.unitCost, reference: v.reference, note: v.note }, product, location);
    } else {
      res = await applyMovement(tx, ctx, { productId: v.productId, locationId: v.locationId, kind: "issue", delta: -v.quantity, reference: v.reference, note: v.note }, product, location);
    }
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: `inventory.stock_${v.kind === "count" ? "counted" : v.kind === "receive" ? "received" : "issued"}`,
      targetType: "inventory_product", targetId: v.productId, metadata: { name: product.name, location: location.name, balance: res.balance },
    });
    return res;
  }).catch(checkViolation);
}

export async function transferStock(ctx: OrgContext, input: unknown): Promise<{ from: number; to: number }> {
  assertPermission(ctx, "inventory.manage");
  const v = parseInput(transferSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const product = await ownProduct(tx, ctx.organizationId, v.productId);
    const from = await ownLocation(tx, ctx.organizationId, v.fromLocationId, "fromLocationId");
    const to = await ownLocation(tx, ctx.organizationId, v.toLocationId, "toLocationId");
    const transferId = crypto.randomUUID();
    // Lock in a fixed order so two opposite transfers can't deadlock.
    const [first, second] = [v.fromLocationId, v.toLocationId].sort();
    for (const loc of [first, second]) {
      await tx`insert into inventory_stock (organization_id, product_id, location_id, quantity) values (${ctx.organizationId}, ${v.productId}, ${loc}, 0) on conflict (product_id, location_id) do nothing`;
      await tx`select 1 from inventory_stock where product_id = ${v.productId} and location_id = ${loc} for update`;
    }
    const out = await applyMovement(tx, ctx, { productId: v.productId, locationId: from.id, kind: "transfer_out", delta: -v.quantity, note: v.note, transferId, reference: `To ${to.name}` }, product, from);
    const inn = await applyMovement(tx, ctx, { productId: v.productId, locationId: to.id, kind: "transfer_in", delta: v.quantity, note: v.note, transferId, reference: `From ${from.name}` }, product, to);
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "inventory.stock_transferred", targetType: "inventory_product", targetId: v.productId, metadata: { name: product.name, from: from.name, to: to.name, quantity: v.quantity } });
    return { from: out.balance, to: inn.balance };
  }).catch(checkViolation);
}

export async function listMovements(ctx: OrgContext, opts: { productId?: string; locationId?: string; kind?: string; limit?: number } = {}): Promise<MovementRow[]> {
  assertPermission(ctx, "inventory.read");
  if ((opts.productId && !isUuid(opts.productId)) || (opts.locationId && !isUuid(opts.locationId))) return [];
  const sql = getDb();
  const kind = opts.kind && ["receive", "issue", "adjust", "transfer"].includes(opts.kind) ? opts.kind : null;
  const rows = await sql<{
    id: string; kind: MovementKind; quantity: string; balance_after: string; unit_cost: string | null; reference: string | null; note: string | null;
    product_id: string; sku: string; product_name: string; unit: string; location_id: string; location_name: string; by: string | null; created_at: Date;
  }[]>`
    select m.id, m.kind, m.quantity, m.balance_after, m.unit_cost, m.reference, m.note, p.id as product_id, p.sku, p.name as product_name, p.unit,
      l.id as location_id, l.name as location_name, nullif(pr.name, '') as by, m.created_at
    from inventory_movement m
    join inventory_product p on p.id = m.product_id
    join inventory_location l on l.id = m.location_id
    left join profile pr on pr.id = m.created_by_id
    where m.organization_id = ${ctx.organizationId}
      ${opts.productId ? sql`and m.product_id = ${opts.productId}` : sql``}
      ${opts.locationId ? sql`and m.location_id = ${opts.locationId}` : sql``}
      ${kind === "transfer" ? sql`and m.kind in ('transfer_in', 'transfer_out')` : kind ? sql`and m.kind = ${kind}` : sql``}
    order by m.created_at desc, m.id
    limit ${Math.min(Math.max(opts.limit ?? 200, 1), 500)}`;
  return rows.map((r) => ({
    id: r.id, kind: r.kind, quantity: n(r.quantity), balanceAfter: n(r.balance_after), unitCost: r.unit_cost === null ? null : n(r.unit_cost), reference: r.reference, note: r.note,
    product: { id: r.product_id, sku: r.sku, name: r.product_name, unit: r.unit }, location: { id: r.location_id, name: r.location_name }, by: r.by, createdAt: r.created_at,
  }));
}

export interface InventoryOverview {
  products: number; units: number; value: number; retailValue: number; low: number; out: number; locations: number;
  in30: number; out30: number; daily: { day: string; in: number; out: number }[];
}

export async function getInventoryOverview(ctx: OrgContext): Promise<InventoryOverview> {
  assertPermission(ctx, "inventory.read");
  const sql = getDb();
  const [[t], [m], daily] = await Promise.all([
    sql<{ products: number; units: string; value: string; retail: string; low: number; out: number; locations: number }[]>`
      with p as (
        select p.id, p.cost_price, p.sale_price, p.reorder_level, coalesce(sum(s.quantity), 0) as qty
        from inventory_product p left join inventory_stock s on s.product_id = p.id
        where p.organization_id = ${ctx.organizationId} and p.archived_at is null group by p.id
      )
      select count(*)::int as products, coalesce(sum(qty), 0) as units, coalesce(sum(qty * cost_price), 0) as value, coalesce(sum(qty * sale_price), 0) as retail,
        count(*) filter (where reorder_level > 0 and qty <= reorder_level and qty > 0)::int as low, count(*) filter (where qty = 0)::int as out,
        (select count(*)::int from inventory_location where organization_id = ${ctx.organizationId} and archived_at is null) as locations
      from p`,
    sql<{ inn: string; out: string }[]>`
      select coalesce(sum(quantity) filter (where kind = 'receive'), 0) as inn, coalesce(-sum(quantity) filter (where kind = 'issue'), 0) as out
      from inventory_movement where organization_id = ${ctx.organizationId} and created_at >= now() - interval '30 days'`,
    sql<{ day: string; inn: string; out: string }[]>`
      select to_char(d, 'YYYY-MM-DD') as day,
        coalesce(sum(m.quantity) filter (where m.kind = 'receive'), 0) as inn, coalesce(-sum(m.quantity) filter (where m.kind = 'issue'), 0) as out
      from generate_series((now() at time zone ${ctx.organization.timezone})::date - 13, (now() at time zone ${ctx.organization.timezone})::date, interval '1 day') d
      left join inventory_movement m on m.organization_id = ${ctx.organizationId} and (m.created_at at time zone ${ctx.organization.timezone})::date = d::date
      group by d order by d`,
  ]);
  return {
    products: t.products, units: n(t.units), value: Math.round(n(t.value) * 100) / 100, retailValue: Math.round(n(t.retail) * 100) / 100, low: t.low, out: t.out, locations: t.locations,
    in30: n(m.inn), out30: n(m.out), daily: daily.map((d) => ({ day: d.day, in: n(d.inn), out: n(d.out) })),
  };
}
