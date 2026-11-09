import "server-only";
import { getDb, transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { computeTotals, documentSchema, estimateStatusSchema, paymentSchema, voidSchema } from "@/lib/validation/finance";
import { assertOwnCompany, assertOwnProject, docNumber, KIND_LABEL, type DocumentKind } from "./shared";

/**
 * Invoices and estimates. Drafts can be edited freely; an issued invoice is
 * fixed (only payments are recorded against it, or it is voided). Totals are
 * always worked out on the server from the lines, never taken from the browser.
 *
 * Shown status (worked out, not stored):
 *   invoice: draft · open · partially paid · paid · overdue · void
 *   estimate: draft · sent · accepted · declined
 */
export type InvoiceState = "draft" | "open" | "partial" | "paid" | "overdue" | "void";
export type EstimateState = "draft" | "sent" | "accepted" | "declined";

export interface DocumentRow {
  id: string;
  kind: DocumentKind;
  number: string;
  status: string;
  state: InvoiceState | EstimateState;
  billToName: string;
  billToEmail: string | null;
  billToAddress: string | null;
  company: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  notes: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  issuedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  convertedFrom: { id: string; number: string } | null;
  convertedTo: { id: string; number: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentLine { id: string; description: string; quantity: number; unitPrice: number; taxRate: number; amount: number }
export interface PaymentRow { id: string; amount: number; paidOn: string; method: string; reference: string | null; notes: string | null; recordedBy: string | null; createdAt: Date }
export interface DocumentDetail extends DocumentRow { lines: DocumentLine[]; payments: PaymentRow[] }

type DocDbRow = {
  id: string; kind: DocumentKind; number: number; status: string; bill_to_name: string; bill_to_email: string | null; bill_to_address: string | null;
  company_id: string | null; company_name: string | null; project_id: string | null; project_name: string | null;
  issue_date: string; due_date: string | null; currency: string; notes: string | null;
  subtotal: string; tax_total: string; total: string; amount_paid: string;
  issued_at: Date | null; voided_at: Date | null; void_reason: string | null;
  from_id: string | null; from_number: number | null; to_id: string | null; to_number: number | null; created_at: Date; updated_at: Date; today: string;
};

function stateOf(r: { kind: DocumentKind; status: string; total: number; paid: number; dueDate: string | null; today: string }): InvoiceState | EstimateState {
  if (r.kind === "estimate") return r.status as EstimateState;
  if (r.status === "draft") return "draft";
  if (r.status === "void") return "void";
  if (r.paid >= r.total) return "paid";
  if (r.dueDate && r.dueDate < r.today) return "overdue";
  return r.paid > 0 ? "partial" : "open";
}

const toDoc = (r: DocDbRow): DocumentRow => {
  const total = Number(r.total), paid = Number(r.amount_paid);
  return {
    id: r.id, kind: r.kind, number: docNumber(r.kind, r.number), status: r.status,
    state: stateOf({ kind: r.kind, status: r.status, total, paid, dueDate: r.due_date, today: r.today }),
    billToName: r.bill_to_name, billToEmail: r.bill_to_email, billToAddress: r.bill_to_address,
    company: r.company_id ? { id: r.company_id, name: r.company_name! } : null,
    project: r.project_id ? { id: r.project_id, name: r.project_name! } : null,
    issueDate: r.issue_date, dueDate: r.due_date, currency: r.currency, notes: r.notes,
    subtotal: Number(r.subtotal), taxTotal: Number(r.tax_total), total, amountPaid: paid,
    balance: r.status === "issued" ? Math.round((total - paid) * 100) / 100 : 0,
    issuedAt: r.issued_at, voidedAt: r.voided_at, voidReason: r.void_reason,
    convertedFrom: r.from_id ? { id: r.from_id, number: docNumber("estimate", r.from_number!) } : null,
    convertedTo: r.to_id ? { id: r.to_id, number: docNumber("invoice", r.to_number!) } : null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
};

function docQuery(sql: Db, ctx: OrgContext, where: ReturnType<Db>) {
  return sql<DocDbRow[]>`
    select d.id, d.kind, d.number, d.status, d.bill_to_name, d.bill_to_email, d.bill_to_address,
      c.id as company_id, c.name as company_name, p.id as project_id, p.name as project_name,
      to_char(d.issue_date, 'YYYY-MM-DD') as issue_date, to_char(d.due_date, 'YYYY-MM-DD') as due_date,
      d.currency, d.notes, d.subtotal, d.tax_total, d.total, d.amount_paid, d.issued_at, d.voided_at, d.void_reason,
      f.id as from_id, f.number as from_number, t.id as to_id, t.number as to_number, d.created_at, d.updated_at,
      to_char((now() at time zone ${ctx.organization.timezone})::date, 'YYYY-MM-DD') as today
    from finance_document d
    left join crm_company c on c.id = d.company_id and c.organization_id = d.organization_id
    left join project p on p.id = d.project_id and p.organization_id = d.organization_id
    left join finance_document f on f.id = d.converted_from_id and f.organization_id = d.organization_id
    left join finance_document t on t.converted_from_id = d.id and t.organization_id = d.organization_id
    where d.organization_id = ${ctx.organizationId} and ${where}
    order by d.issue_date desc, d.number desc
    limit 1000`;
}

export interface ListDocumentsOptions { kind: DocumentKind; state?: string; query?: string; companyId?: string; projectId?: string }

export async function listDocuments(ctx: OrgContext, opts: ListDocumentsOptions): Promise<DocumentRow[]> {
  assertPermission(ctx, "finance.invoice.read");
  const sql = getDb();
  if ([opts.companyId, opts.projectId].some((i) => i !== undefined && !isUuid(i))) return [];
  const q = opts.query?.trim() ? `%${opts.query.trim().toLowerCase()}%` : null;
  const rows = await docQuery(sql, ctx, sql`d.kind = ${opts.kind}
    ${opts.companyId ? sql`and d.company_id = ${opts.companyId}` : sql``}
    ${opts.projectId ? sql`and d.project_id = ${opts.projectId}` : sql``}
    ${q ? sql`and (lower(d.bill_to_name) like ${q} or lower(coalesce(c.name, '')) like ${q} or lower(coalesce(d.notes, '')) like ${q}
      or ${opts.kind === "invoice" ? "inv-" : "est-"} || lpad(d.number::text, 4, '0') like ${q})` : sql``}`);
  const docs = rows.map(toDoc);
  return opts.state ? docs.filter((d) => d.state === opts.state || (opts.state === "unpaid" && ["open", "partial", "overdue"].includes(d.state))) : docs;
}

export async function getDocument(ctx: OrgContext, id: string, kind?: DocumentKind): Promise<DocumentDetail> {
  assertPermission(ctx, "finance.invoice.read");
  if (!isUuid(id)) throw new NotFoundError("Not found");
  const sql = getDb();
  const [row] = await docQuery(sql, ctx, sql`d.id = ${id}`);
  if (!row || (kind && row.kind !== kind)) throw new NotFoundError(`${kind ? KIND_LABEL[kind] : "Document"} not found`);
  const [lines, payments] = await Promise.all([
    sql<{ id: string; description: string; quantity: string; unit_price: string; tax_rate: string; amount: string }[]>`
      select id, description, quantity, unit_price, tax_rate, amount from finance_document_line
      where document_id = ${id} and organization_id = ${ctx.organizationId} order by position`,
    sql<{ id: string; amount: string; paid_on: string; method: string; reference: string | null; notes: string | null; recorded_by: string | null; created_at: Date }[]>`
      select f.id, f.amount, to_char(f.paid_on, 'YYYY-MM-DD') as paid_on, f.method, f.reference, f.notes, pr.name as recorded_by, f.created_at
      from finance_payment f left join profile pr on pr.id = f.recorded_by_id
      where f.invoice_id = ${id} and f.organization_id = ${ctx.organizationId} order by f.paid_on, f.created_at`,
  ]);
  return {
    ...toDoc(row),
    lines: lines.map((l) => ({ id: l.id, description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unit_price), taxRate: Number(l.tax_rate), amount: Number(l.amount) })),
    payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), paidOn: p.paid_on, method: p.method, reference: p.reference, notes: p.notes, recordedBy: p.recorded_by, createdAt: p.created_at })),
  };
}

/** Locks the document for a change and confirms it's in this organization. */
async function lockDocument(tx: Db, ctx: OrgContext, id: string) {
  if (!isUuid(id)) throw new NotFoundError("Not found");
  const [d] = await tx<{ id: string; kind: DocumentKind; number: number; status: string; bill_to_name: string; total: string; amount_paid: string; currency: string; issue_date: string }[]>`
    select id, kind, number, status, bill_to_name, total, amount_paid, currency, to_char(issue_date, 'YYYY-MM-DD') as issue_date
    from finance_document where id = ${id} and organization_id = ${ctx.organizationId} for update`;
  if (!d) throw new NotFoundError("Not found");
  return d;
}

async function writeLines(tx: Db, organizationId: string, documentId: string, lines: { description: string; quantity: number; unitPrice: number; taxRate: number }[]) {
  const t = computeTotals(lines);
  await tx`delete from finance_document_line where document_id = ${documentId} and organization_id = ${organizationId}`;
  for (const [i, l] of lines.entries()) {
    await tx`insert into finance_document_line (organization_id, document_id, position, description, quantity, unit_price, tax_rate, amount)
      values (${organizationId}, ${documentId}, ${i}, ${l.description}, ${l.quantity}, ${l.unitPrice}, ${l.taxRate}, ${t.amounts[i]})`;
  }
  return t;
}

export async function createDocument(ctx: OrgContext, kind: DocumentKind, input: unknown): Promise<{ id: string; number: string }> {
  assertPermission(ctx, "finance.invoice.create");
  const d = parseInput(documentSchema, input);
  return transaction(async (tx) => {
    // Serialises numbering per organization.
    await tx`select 1 from organization where id = ${ctx.organizationId} for update`;
    await assertWritable(tx, ctx.organizationId);
    await assertOwnCompany(tx, ctx.organizationId, d.companyId);
    await assertOwnProject(tx, ctx.organizationId, d.projectId);
    const [{ next }] = await tx<{ next: number }[]>`
      select coalesce(max(number), 0) + 1 as next from finance_document where organization_id = ${ctx.organizationId} and kind = ${kind}`;
    const [row] = await tx<{ id: string }[]>`
      insert into finance_document (organization_id, kind, number, company_id, project_id, bill_to_name, bill_to_email, bill_to_address,
        issue_date, due_date, currency, notes, created_by_id)
      values (${ctx.organizationId}, ${kind}, ${next}, ${d.companyId}, ${d.projectId}, ${d.billToName}, ${d.billToEmail}, ${d.billToAddress},
        ${d.issueDate}, ${d.dueDate}, ${d.currency ?? ctx.organization.currency}, ${d.notes}, ${ctx.userId})
      returning id`;
    const t = await writeLines(tx, ctx.organizationId, row.id, d.lines);
    await tx`update finance_document set subtotal = ${t.subtotal}, tax_total = ${t.taxTotal}, total = ${t.total} where id = ${row.id}`;
    const number = docNumber(kind, next);
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: kind === "invoice" ? "finance.invoice_created" : "finance.estimate_created",
      targetType: "finance_document", targetId: row.id, metadata: { number, client: d.billToName, total: t.total } });
    return { id: row.id, number };
  });
}

/** Only a draft invoice, or an estimate not yet accepted, can be edited. */
export async function updateDocument(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "finance.invoice.create");
  const d = parseInput(documentSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const doc = await lockDocument(tx, ctx, id);
    if (doc.kind === "invoice" && doc.status !== "draft") throw new ConflictError("An issued invoice can't be changed. Void it and create a new one instead.");
    if (doc.kind === "estimate" && doc.status === "accepted") throw new ConflictError("An accepted estimate can't be changed.");
    await assertOwnCompany(tx, ctx.organizationId, d.companyId);
    await assertOwnProject(tx, ctx.organizationId, d.projectId);
    const t = await writeLines(tx, ctx.organizationId, doc.id, d.lines);
    await tx`update finance_document set company_id = ${d.companyId}, project_id = ${d.projectId}, bill_to_name = ${d.billToName},
      bill_to_email = ${d.billToEmail}, bill_to_address = ${d.billToAddress}, issue_date = ${d.issueDate}, due_date = ${d.dueDate},
      currency = ${d.currency ?? doc.currency}, notes = ${d.notes}, subtotal = ${t.subtotal}, tax_total = ${t.taxTotal}, total = ${t.total}, updated_at = now()
      where id = ${doc.id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: doc.kind === "invoice" ? "finance.invoice_updated" : "finance.estimate_updated",
      targetType: "finance_document", targetId: doc.id, metadata: { number: docNumber(doc.kind, doc.number), total: t.total } });
  });
}

/** Deletes a draft invoice or any estimate that hasn't become an invoice. Issued invoices are voided, never deleted. */
export async function deleteDocument(ctx: OrgContext, id: string): Promise<{ kind: DocumentKind }> {
  assertPermission(ctx, "finance.invoice.create");
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const doc = await lockDocument(tx, ctx, id);
    if (doc.kind === "invoice" && doc.status !== "draft") throw new ConflictError("Issued invoices stay on record. Void it instead.");
    const [converted] = await tx`select 1 from finance_document where converted_from_id = ${doc.id} and organization_id = ${ctx.organizationId}`;
    if (converted) throw new ConflictError("This estimate became an invoice, so it stays on record.");
    await tx`delete from finance_document where id = ${doc.id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: doc.kind === "invoice" ? "finance.invoice_deleted" : "finance.estimate_deleted",
      targetType: "finance_document", targetId: doc.id, metadata: { number: docNumber(doc.kind, doc.number) } });
    return { kind: doc.kind };
  });
}

export async function issueInvoice(ctx: OrgContext, id: string): Promise<void> {
  assertPermission(ctx, "finance.invoice.issue");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const doc = await lockDocument(tx, ctx, id);
    if (doc.kind !== "invoice") throw new NotFoundError("Invoice not found");
    if (doc.status !== "draft") throw new ConflictError("This invoice has already been issued.");
    if (Number(doc.total) <= 0) throw new ValidationError("An invoice needs a total above zero before it's issued.");
    await tx`update finance_document set status = 'issued', issued_at = now(), updated_at = now() where id = ${doc.id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.invoice_issued",
      targetType: "finance_document", targetId: doc.id, metadata: { number: docNumber("invoice", doc.number), client: doc.bill_to_name, total: Number(doc.total) } });
  });
}

export async function voidInvoice(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "finance.invoice.issue");
  const { reason } = parseInput(voidSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const doc = await lockDocument(tx, ctx, id);
    if (doc.kind !== "invoice") throw new NotFoundError("Invoice not found");
    if (doc.status !== "issued") throw new ConflictError(doc.status === "void" ? "This invoice is already void." : "Delete a draft instead of voiding it.");
    if (Number(doc.amount_paid) > 0) throw new ConflictError("This invoice has payments recorded. Remove them before voiding it.");
    await tx`update finance_document set status = 'void', voided_at = now(), void_reason = ${reason}, updated_at = now() where id = ${doc.id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.invoice_voided",
      targetType: "finance_document", targetId: doc.id, metadata: { number: docNumber("invoice", doc.number), reason } });
  });
}

export async function setEstimateStatus(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "finance.invoice.issue");
  const { status } = parseInput(estimateStatusSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const doc = await lockDocument(tx, ctx, id);
    if (doc.kind !== "estimate") throw new NotFoundError("Estimate not found");
    const [converted] = await tx`select 1 from finance_document where converted_from_id = ${doc.id} and organization_id = ${ctx.organizationId}`;
    if (converted) throw new ConflictError("This estimate is already an invoice.");
    if (status !== "draft" && Number(doc.total) <= 0) throw new ValidationError("Add items to the estimate first.");
    await tx`update finance_document set status = ${status}, issued_at = ${status === "draft" ? null : tx`coalesce(issued_at, now())`}, updated_at = now() where id = ${doc.id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.estimate_status_changed",
      targetType: "finance_document", targetId: doc.id, metadata: { number: docNumber("estimate", doc.number), status } });
  });
}

/** An accepted estimate becomes a draft invoice with the same lines (once). */
export async function convertEstimate(ctx: OrgContext, id: string): Promise<{ id: string; number: string }> {
  assertPermission(ctx, "finance.invoice.create");
  return transaction(async (tx) => {
    await tx`select 1 from organization where id = ${ctx.organizationId} for update`;
    await assertWritable(tx, ctx.organizationId);
    const doc = await lockDocument(tx, ctx, id);
    if (doc.kind !== "estimate") throw new NotFoundError("Estimate not found");
    if (doc.status !== "accepted") throw new ConflictError("Mark the estimate as accepted first.");
    const [existing] = await tx<{ id: string; number: number }[]>`
      select id, number from finance_document where converted_from_id = ${doc.id} and organization_id = ${ctx.organizationId}`;
    if (existing) return { id: existing.id, number: docNumber("invoice", existing.number) };
    const [{ next }] = await tx<{ next: number }[]>`
      select coalesce(max(number), 0) + 1 as next from finance_document where organization_id = ${ctx.organizationId} and kind = 'invoice'`;
    const today = (await tx<{ d: string }[]>`select to_char((now() at time zone ${ctx.organization.timezone})::date, 'YYYY-MM-DD') as d`)[0].d;
    const [row] = await tx<{ id: string }[]>`
      insert into finance_document (organization_id, kind, number, company_id, project_id, bill_to_name, bill_to_email, bill_to_address,
        issue_date, due_date, currency, notes, subtotal, tax_total, total, converted_from_id, created_by_id)
      select organization_id, 'invoice', ${next}, company_id, project_id, bill_to_name, bill_to_email, bill_to_address,
        ${today}::date, ${today}::date + 30, currency, notes, subtotal, tax_total, total, id, ${ctx.userId}
      from finance_document where id = ${doc.id} and organization_id = ${ctx.organizationId}
      returning id`;
    await tx`insert into finance_document_line (organization_id, document_id, position, description, quantity, unit_price, tax_rate, amount)
      select organization_id, ${row.id}, position, description, quantity, unit_price, tax_rate, amount
      from finance_document_line where document_id = ${doc.id} and organization_id = ${ctx.organizationId}`;
    const number = docNumber("invoice", next);
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.estimate_converted",
      targetType: "finance_document", targetId: row.id, metadata: { number: docNumber("estimate", doc.number), invoice: number } });
    return { id: row.id, number };
  });
}

/** Records money the customer paid. Never more than what's still owed. */
export async function recordPayment(ctx: OrgContext, invoiceId: string, input: unknown): Promise<{ id: string; paid: boolean }> {
  assertPermission(ctx, "finance.payment.record");
  const p = parseInput(paymentSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const doc = await lockDocument(tx, ctx, invoiceId);
    if (doc.kind !== "invoice") throw new NotFoundError("Invoice not found");
    if (doc.status !== "issued") throw new ConflictError(doc.status === "void" ? "This invoice is void." : "Issue the invoice before recording payments.");
    const owed = Math.round((Number(doc.total) - Number(doc.amount_paid)) * 100) / 100;
    if (owed <= 0) throw new ConflictError("This invoice is already paid in full.");
    if (p.amount > owed) throw new ValidationError(`Only ${owed.toFixed(2)} ${doc.currency} is still owed.`, { amount: [`At most ${owed.toFixed(2)}`] });
    if (p.paidOn < doc.issue_date) throw new ValidationError("The payment date can't be before the invoice date.", { paidOn: ["Can't be before the invoice date"] });
    const [row] = await tx<{ id: string }[]>`
      insert into finance_payment (organization_id, invoice_id, amount, paid_on, method, reference, notes, recorded_by_id)
      values (${ctx.organizationId}, ${doc.id}, ${p.amount}, ${p.paidOn}, ${p.method}, ${p.reference}, ${p.notes}, ${ctx.userId})
      returning id`;
    const [after] = await tx<{ total: string; amount_paid: string }[]>`
      update finance_document set amount_paid = amount_paid + ${p.amount}, updated_at = now() where id = ${doc.id} returning total, amount_paid`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.payment_recorded",
      targetType: "finance_document", targetId: doc.id, metadata: { number: docNumber("invoice", doc.number), amount: p.amount, method: p.method } });
    return { id: row.id, paid: Number(after.amount_paid) >= Number(after.total) };
  });
}

export async function deletePayment(ctx: OrgContext, paymentId: string): Promise<{ invoiceId: string }> {
  assertPermission(ctx, "finance.payment.record");
  if (!isUuid(paymentId)) throw new NotFoundError("Payment not found");
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [pay] = await tx<{ invoice_id: string }[]>`select invoice_id from finance_payment where id = ${paymentId} and organization_id = ${ctx.organizationId}`;
    if (!pay) throw new NotFoundError("Payment not found");
    const doc = await lockDocument(tx, ctx, pay.invoice_id);
    const [gone] = await tx<{ amount: string }[]>`delete from finance_payment where id = ${paymentId} and organization_id = ${ctx.organizationId} returning amount`;
    if (!gone) throw new NotFoundError("Payment not found");
    await tx`update finance_document set amount_paid = greatest(0, amount_paid - ${gone.amount}), updated_at = now() where id = ${doc.id}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.payment_deleted",
      targetType: "finance_document", targetId: doc.id, metadata: { number: docNumber("invoice", doc.number), amount: Number(gone.amount) } });
    return { invoiceId: doc.id };
  });
}

/** Clients and projects a document can be linked to, limited to what this person may see. */
export async function listDocumentLinkOptions(ctx: OrgContext) {
  const sql = getDb();
  const [companies, projects] = await Promise.all([
    can(ctx, "crm.contact.read")
      ? sql<{ id: string; name: string }[]>`select id, name from crm_company where organization_id = ${ctx.organizationId} and archived_at is null order by lower(name) limit 500`
      : [],
    can(ctx, "projects.project.read")
      ? sql<{ id: string; name: string; company_id: string | null }[]>`
          select p.id, p.name, p.company_id from project p where p.organization_id = ${ctx.organizationId} and p.archived_at is null
            ${can(ctx, "projects.project.update") ? sql`` : sql`and exists (select 1 from project_member pm where pm.project_id = p.id and pm.member_id = ${ctx.memberId})`}
          order by lower(p.name) limit 500`
      : [],
  ]);
  return { companies, projects: projects.map((p) => ({ id: p.id, name: p.name, companyId: p.company_id })) };
}
