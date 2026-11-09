import "server-only";
import { getDb, transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { expenseSchema, reviewExpenseSchema } from "@/lib/validation/finance";
import { assertOwnProject, assertOwnVendor } from "./shared";

/**
 * Expenses: money the organization spent. Someone with "manage expenses" adds
 * them (pending); an approver approves or rejects; an approved expense is
 * marked paid once it's been paid out. Nobody approves their own expense
 * unless they're the workspace owner.
 */
export type ExpenseStatus = "pending" | "approved" | "rejected" | "paid";
export interface ExpenseRow {
  id: string; description: string; category: string; amount: number; currency: string; spentOn: string;
  vendor: { id: string; name: string } | null; project: { id: string; name: string } | null; notes: string | null;
  status: ExpenseStatus; submittedBy: { id: string; name: string } | null; reviewedBy: string | null; reviewedAt: Date | null; reviewNote: string | null;
  paidAt: Date | null; createdAt: Date;
  /** This person can approve or reject it (not their own, unless owner). */
  canReview: boolean;
}

const seesExpenses = (ctx: OrgContext) => can(ctx, "finance.expense.read") || can(ctx, "finance.expense.manage") || can(ctx, "finance.expense.approve");

export async function listExpenses(ctx: OrgContext, opts: { status?: string; query?: string; vendorId?: string; projectId?: string; category?: string } = {}): Promise<ExpenseRow[]> {
  if (!seesExpenses(ctx)) throw new ForbiddenError();
  const sql = getDb();
  if ([opts.vendorId, opts.projectId].some((i) => i !== undefined && !isUuid(i))) return [];
  const q = opts.query?.trim() ? `%${opts.query.trim().toLowerCase()}%` : null;
  const rows = await sql<{
    id: string; description: string; category: string; amount: string; currency: string; spent_on: string; vendor_id: string | null; vendor_name: string | null;
    project_id: string | null; project_name: string | null; notes: string | null; status: ExpenseStatus; sub_id: string | null; sub_name: string | null;
    reviewer: string | null; reviewed_at: Date | null; review_note: string | null; paid_at: Date | null; created_at: Date;
  }[]>`
    select e.id, e.description, e.category, e.amount, e.currency, to_char(e.spent_on, 'YYYY-MM-DD') as spent_on,
      v.id as vendor_id, v.name as vendor_name, p.id as project_id, p.name as project_name, e.notes, e.status,
      sm.id as sub_id, sp.name as sub_name, rp.name as reviewer, e.reviewed_at, e.review_note, e.paid_at, e.created_at
    from finance_expense e
    left join finance_vendor v on v.id = e.vendor_id and v.organization_id = e.organization_id
    left join project p on p.id = e.project_id and p.organization_id = e.organization_id
    left join organization_member sm on sm.id = e.submitted_by_member_id and sm.organization_id = e.organization_id
    left join profile sp on sp.id = sm.user_id
    left join organization_member rm on rm.id = e.reviewed_by_member_id and rm.organization_id = e.organization_id
    left join profile rp on rp.id = rm.user_id
    where e.organization_id = ${ctx.organizationId}
      ${opts.status ? sql`and e.status = ${opts.status}` : sql``}
      ${opts.category ? sql`and e.category = ${opts.category}` : sql``}
      ${opts.vendorId ? sql`and e.vendor_id = ${opts.vendorId}` : sql``}
      ${opts.projectId ? sql`and e.project_id = ${opts.projectId}` : sql``}
      ${q ? sql`and (lower(e.description) like ${q} or lower(coalesce(v.name, '')) like ${q})` : sql``}
    order by e.spent_on desc, e.created_at desc
    limit 1000`;
  const approver = can(ctx, "finance.expense.approve");
  return rows.map((r) => ({
    id: r.id, description: r.description, category: r.category, amount: Number(r.amount), currency: r.currency, spentOn: r.spent_on,
    vendor: r.vendor_id ? { id: r.vendor_id, name: r.vendor_name! } : null, project: r.project_id ? { id: r.project_id, name: r.project_name! } : null,
    notes: r.notes, status: r.status, submittedBy: r.sub_id ? { id: r.sub_id, name: r.sub_name ?? "Former member" } : null,
    reviewedBy: r.reviewer, reviewedAt: r.reviewed_at, reviewNote: r.review_note, paidAt: r.paid_at, createdAt: r.created_at,
    canReview: approver && (r.sub_id !== ctx.memberId || ctx.isOwner),
  }));
}

async function lockExpense(tx: Db, ctx: OrgContext, id: string) {
  if (!isUuid(id)) throw new NotFoundError("Expense not found");
  const [e] = await tx<{ id: string; description: string; status: ExpenseStatus; submitted_by_member_id: string | null }[]>`
    select id, description, status, submitted_by_member_id from finance_expense where id = ${id} and organization_id = ${ctx.organizationId} for update`;
  if (!e) throw new NotFoundError("Expense not found");
  return e;
}

export async function createExpense(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "finance.expense.manage");
  const e = parseInput(expenseSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertOwnVendor(tx, ctx.organizationId, e.vendorId);
    await assertOwnProject(tx, ctx.organizationId, e.projectId);
    const [row] = await tx<{ id: string }[]>`
      insert into finance_expense (organization_id, description, category, amount, currency, spent_on, vendor_id, project_id, notes, submitted_by_member_id)
      values (${ctx.organizationId}, ${e.description}, ${e.category}, ${e.amount}, ${e.currency ?? ctx.organization.currency}, ${e.spentOn},
        ${e.vendorId}, ${e.projectId}, ${e.notes}, ${ctx.memberId}) returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.expense_created", targetType: "finance_expense", targetId: row.id, metadata: { description: e.description, amount: e.amount } });
    return row;
  });
}

/** Pending or rejected expenses can be corrected; a corrected rejected one goes back to pending. */
export async function updateExpense(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "finance.expense.manage");
  const e = parseInput(expenseSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const cur = await lockExpense(tx, ctx, id);
    if (cur.status === "approved" || cur.status === "paid") throw new ConflictError("An approved expense can't be changed.");
    await assertOwnVendor(tx, ctx.organizationId, e.vendorId);
    await assertOwnProject(tx, ctx.organizationId, e.projectId);
    await tx`update finance_expense set description = ${e.description}, category = ${e.category}, amount = ${e.amount}, currency = ${e.currency ?? ctx.organization.currency},
      spent_on = ${e.spentOn}, vendor_id = ${e.vendorId}, project_id = ${e.projectId}, notes = ${e.notes}, status = 'pending',
      reviewed_by_member_id = null, reviewed_at = null, review_note = null, updated_at = now()
      where id = ${cur.id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.expense_updated", targetType: "finance_expense", targetId: cur.id, metadata: { description: e.description, amount: e.amount } });
  });
}

export async function reviewExpense(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "finance.expense.approve");
  const r = parseInput(reviewExpenseSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const cur = await lockExpense(tx, ctx, id);
    if (cur.status !== "pending") throw new ConflictError("This expense has already been reviewed.");
    if (cur.submitted_by_member_id === ctx.memberId && !ctx.isOwner) throw new ForbiddenError("Someone else has to approve an expense you added.");
    await tx`update finance_expense set status = ${r.decision === "approve" ? "approved" : "rejected"}, reviewed_by_member_id = ${ctx.memberId},
      reviewed_at = now(), review_note = ${r.note}, updated_at = now() where id = ${cur.id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: r.decision === "approve" ? "finance.expense_approved" : "finance.expense_rejected",
      targetType: "finance_expense", targetId: cur.id, metadata: { description: cur.description, note: r.note } });
  });
}

export async function markExpensePaid(ctx: OrgContext, id: string): Promise<void> {
  assertPermission(ctx, "finance.expense.approve");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const cur = await lockExpense(tx, ctx, id);
    if (cur.status !== "approved") throw new ConflictError(cur.status === "paid" ? "This expense is already paid." : "Approve the expense first.");
    await tx`update finance_expense set status = 'paid', paid_at = now(), updated_at = now() where id = ${cur.id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.expense_paid", targetType: "finance_expense", targetId: cur.id, metadata: { description: cur.description } });
  });
}

export async function deleteExpense(ctx: OrgContext, id: string): Promise<void> {
  assertPermission(ctx, "finance.expense.manage");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const cur = await lockExpense(tx, ctx, id);
    if (cur.status === "approved" || cur.status === "paid") throw new ConflictError("Approved expenses stay on record.");
    await tx`delete from finance_expense where id = ${cur.id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.expense_deleted", targetType: "finance_expense", targetId: cur.id, metadata: { description: cur.description } });
  });
}
