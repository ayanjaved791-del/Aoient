import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { isUniqueViolation } from "@/server/database/errors";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { vendorSchema } from "@/lib/validation/finance";

export interface VendorRow {
  id: string; name: string; email: string | null; phone: string | null; taxId: string | null; notes: string | null;
  archived: boolean; expenseCount: number; spent: number; createdAt: Date;
}

/** Vendors are visible to anyone who sees or manages expenses; changing them is separate. */
export async function listVendors(ctx: OrgContext, opts: { archived?: boolean; query?: string } = {}): Promise<VendorRow[]> {
  if (!can(ctx, "finance.vendor.manage") && !can(ctx, "finance.expense.read") && !can(ctx, "finance.expense.manage")) throw new ForbiddenError();
  const sql = getDb();
  const q = opts.query?.trim() ? `%${opts.query.trim().toLowerCase()}%` : null;
  const rows = await sql<{ id: string; name: string; email: string | null; phone: string | null; tax_id: string | null; notes: string | null; archived: boolean; n: number; spent: string; created_at: Date }[]>`
    select v.id, v.name, v.email, v.phone, v.tax_id, v.notes, v.archived_at is not null as archived, v.created_at,
      count(e.id)::int as n, coalesce(sum(e.amount) filter (where e.status in ('approved', 'paid') and e.currency = ${ctx.organization.currency}), 0) as spent
    from finance_vendor v
    left join finance_expense e on e.vendor_id = v.id and e.organization_id = v.organization_id
    where v.organization_id = ${ctx.organizationId} and ${opts.archived ? sql`v.archived_at is not null` : sql`v.archived_at is null`}
      ${q ? sql`and (lower(v.name) like ${q} or lower(coalesce(v.email, '')) like ${q})` : sql``}
    group by v.id
    order by lower(v.name)
    limit 1000`;
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, taxId: r.tax_id, notes: r.notes, archived: r.archived, expenseCount: r.n, spent: Number(r.spent), createdAt: r.created_at }));
}

function vendorConflict(e: unknown): never {
  if (isUniqueViolation(e, "finance_vendor_org_name")) throw new ConflictError("A vendor with this name already exists.");
  throw e;
}

export async function createVendor(ctx: OrgContext, input: unknown): Promise<{ id: string; name: string }> {
  assertPermission(ctx, "finance.vendor.manage");
  const v = parseInput(vendorSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ id: string }[]>`
      insert into finance_vendor (organization_id, name, email, phone, tax_id, notes, created_by_id)
      values (${ctx.organizationId}, ${v.name}, ${v.email}, ${v.phone}, ${v.taxId}, ${v.notes}, ${ctx.userId}) returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.vendor_created", targetType: "finance_vendor", targetId: row.id, metadata: { name: v.name } });
    return { id: row.id, name: v.name };
  }).catch(vendorConflict);
}

export async function updateVendor(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "finance.vendor.manage");
  const v = parseInput(vendorSchema, input);
  if (!isUuid(id)) throw new NotFoundError("Vendor not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const r = await tx`update finance_vendor set name = ${v.name}, email = ${v.email}, phone = ${v.phone}, tax_id = ${v.taxId}, notes = ${v.notes}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    if (r.count === 0) throw new NotFoundError("Vendor not found");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.vendor_updated", targetType: "finance_vendor", targetId: id, metadata: { name: v.name } });
  }).catch(vendorConflict);
}

export async function setVendorArchived(ctx: OrgContext, id: string, archived: boolean): Promise<void> {
  assertPermission(ctx, "finance.vendor.manage");
  if (!isUuid(id)) throw new NotFoundError("Vendor not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ name: string }[]>`
      update finance_vendor set archived_at = ${archived ? tx`now()` : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId} returning name`;
    if (!row) throw new NotFoundError("Vendor not found");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: archived ? "finance.vendor_archived" : "finance.vendor_restored", targetType: "finance_vendor", targetId: id, metadata: { name: row.name } });
  });
}
