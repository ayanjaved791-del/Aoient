/**
 * Finance: invoices, estimates, payments, expenses and vendors. Totals are
 * worked out on the server, money owed can't be overpaid, issued invoices are
 * fixed, and no organization can read or touch another's records.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase } from "../support/db";
import {
  convertEstimate, createDocument, deleteDocument, deletePayment, getDocument, issueInvoice, listDocuments, recordPayment, setEstimateStatus, updateDocument, voidInvoice,
} from "@/server/finance/documents";
import { createExpense, deleteExpense, listExpenses, markExpensePaid, reviewExpense, updateExpense } from "@/server/finance/expenses";
import { createVendor, listVendors, setVendorArchived, updateVendor } from "@/server/finance/vendors";
import { getFinanceOverview } from "@/server/finance/reports";
import { createCompany } from "@/server/crm/contacts";
import { createProject } from "@/server/projects/projects";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const invoice = (over: Record<string, unknown> = {}) => ({
  billToName: "Acme Ltd", issueDate: today(), dueDate: null,
  lines: [{ description: "Design work", quantity: 3, unitPrice: 333.33, taxRate: 10 }, { description: "Hosting", quantity: "1", unitPrice: "20", taxRate: 0 }],
  ...over,
});

describe("finance", () => {
  beforeEach(resetDatabase);

  it("numbers and totals invoices on the server, per organization", async () => {
    const a = await createOrgWithOwner("fin-a");
    const b = await createOrgWithOwner("fin-b");
    const fm = await addMember(a.org.id, "finance_manager");
    // Browser-sent totals are ignored: they're computed from the lines.
    const one = await createDocument(fm.ctx, "invoice", { ...invoice(), total: 1, subtotal: 1 });
    const two = await createDocument(fm.ctx, "invoice", invoice());
    const otherOrg = await createDocument(b.ctx, "invoice", invoice());
    expect([one.number, two.number, otherOrg.number]).toEqual(["INV-0001", "INV-0002", "INV-0001"]);
    const d = await getDocument(fm.ctx, one.id);
    // 3 × 333.33 = 999.99, 10% tax = 100.00, + 20 hosting
    expect(d).toMatchObject({ subtotal: 1019.99, taxTotal: 100, total: 1119.99, amountPaid: 0, state: "draft", currency: a.ctx.organization.currency });
    expect(d.lines.map((l) => l.amount)).toEqual([999.99, 20]);
    const est = await createDocument(fm.ctx, "estimate", invoice());
    expect(est.number).toBe("EST-0001");
  });

  it("issues, takes payments without overpaying, and keeps issued invoices fixed", async () => {
    const { ctx } = await createOrgWithOwner("fin-pay");
    const inv = await createDocument(ctx, "invoice", invoice({ lines: [{ description: "Work", quantity: 1, unitPrice: 1000 }] }));
    await expect(recordPayment(ctx, inv.id, { amount: 10, paidOn: today(), method: "cash" })).rejects.toMatchObject({ code: "CONFLICT" });
    await updateDocument(ctx, inv.id, invoice({ lines: [{ description: "Work", quantity: 2, unitPrice: 500 }], dueDate: daysAgo(-10) }));
    await issueInvoice(ctx, inv.id);
    await expect(updateDocument(ctx, inv.id, invoice())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(deleteDocument(ctx, inv.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(issueInvoice(ctx, inv.id)).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await recordPayment(ctx, inv.id, { amount: "400", paidOn: today(), method: "bank_transfer", reference: "TX-1" })).toMatchObject({ paid: false });
    expect((await getDocument(ctx, inv.id)).state).toBe("partial");
    await expect(recordPayment(ctx, inv.id, { amount: 600.01, paidOn: today(), method: "cash" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(recordPayment(ctx, inv.id, { amount: 0, paidOn: today(), method: "cash" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const last = await recordPayment(ctx, inv.id, { amount: 600, paidOn: today(), method: "card" });
    expect(last.paid).toBe(true);
    const paid = await getDocument(ctx, inv.id);
    expect(paid).toMatchObject({ state: "paid", amountPaid: 1000, balance: 0 });
    await expect(recordPayment(ctx, inv.id, { amount: 1, paidOn: today(), method: "cash" })).rejects.toMatchObject({ code: "CONFLICT" });
    // Voiding needs the payments removed first.
    await expect(voidInvoice(ctx, inv.id, { reason: "Wrong client" })).rejects.toMatchObject({ code: "CONFLICT" });
    for (const p of paid.payments) await deletePayment(ctx, p.id);
    await voidInvoice(ctx, inv.id, { reason: "Wrong client" });
    expect(await getDocument(ctx, inv.id)).toMatchObject({ state: "void", voidReason: "Wrong client", balance: 0 });
  });

  it("shows overdue invoices and lets drafts be deleted", async () => {
    const { ctx } = await createOrgWithOwner("fin-due");
    const late = await createDocument(ctx, "invoice", invoice({ issueDate: daysAgo(40), dueDate: daysAgo(10) }));
    await issueInvoice(ctx, late.id);
    const draft = await createDocument(ctx, "invoice", invoice());
    expect((await listDocuments(ctx, { kind: "invoice", state: "overdue" })).map((d) => d.id)).toEqual([late.id]);
    expect((await listDocuments(ctx, { kind: "invoice", state: "unpaid" })).map((d) => d.id)).toEqual([late.id]);
    expect((await listDocuments(ctx, { kind: "invoice", query: "inv-0002" })).map((d) => d.id)).toEqual([draft.id]);
    await deleteDocument(ctx, draft.id);
    await expect(getDocument(ctx, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("turns an accepted estimate into one invoice", async () => {
    const { ctx } = await createOrgWithOwner("fin-est");
    const est = await createDocument(ctx, "estimate", invoice());
    await expect(convertEstimate(ctx, est.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await setEstimateStatus(ctx, est.id, { status: "sent" });
    await setEstimateStatus(ctx, est.id, { status: "accepted" });
    await expect(updateDocument(ctx, est.id, invoice())).rejects.toMatchObject({ code: "CONFLICT" });
    const inv = await convertEstimate(ctx, est.id);
    expect(await convertEstimate(ctx, est.id)).toEqual(inv);
    const d = await getDocument(ctx, inv.id, "invoice");
    expect(d).toMatchObject({ state: "draft", total: 1119.99, convertedFrom: { id: est.id, number: "EST-0001" } });
    expect(d.lines).toHaveLength(2);
    expect((await getDocument(ctx, est.id)).convertedTo).toEqual({ id: inv.id, number: inv.number });
    await expect(deleteDocument(ctx, est.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(setEstimateStatus(ctx, est.id, { status: "declined" })).rejects.toMatchObject({ code: "CONFLICT" });
    // An invoice id isn't an estimate.
    await expect(getDocument(ctx, inv.id, "estimate")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("runs expenses through approval, and nobody approves their own", async () => {
    const { org, ctx: owner } = await createOrgWithOwner("fin-exp");
    const fm = await addMember(org.id, "finance_manager");
    const fm2 = await addMember(org.id, "finance_manager");
    const v = await createVendor(fm.ctx, { name: "Cloud Co" });
    const e = await createExpense(fm.ctx, { description: "Servers", category: "software", amount: "120.50", spentOn: today(), vendorId: v.id });
    const [row] = await listExpenses(fm.ctx);
    expect(row).toMatchObject({ status: "pending", amount: 120.5, canReview: false, vendor: { name: "Cloud Co" } });
    await expect(reviewExpense(fm.ctx, e.id, { decision: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(markExpensePaid(fm2.ctx, e.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await reviewExpense(fm2.ctx, e.id, { decision: "reject", note: "Need a receipt" });
    await updateExpense(fm.ctx, e.id, { description: "Servers (with receipt)", category: "software", amount: 120.5, spentOn: today(), vendorId: v.id });
    expect((await listExpenses(fm.ctx))[0]).toMatchObject({ status: "pending", reviewNote: null });
    await reviewExpense(fm2.ctx, e.id, { decision: "approve" });
    await expect(reviewExpense(fm2.ctx, e.id, { decision: "reject" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateExpense(fm.ctx, e.id, { description: "Other", category: "other", amount: 1, spentOn: today() })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(deleteExpense(fm.ctx, e.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await markExpensePaid(fm2.ctx, e.id);
    expect((await listVendors(fm.ctx))[0]).toMatchObject({ expenseCount: 1, spent: 120.5 });
    // The owner may approve their own.
    const mine = await createExpense(owner, { description: "Lunch", category: "meals", amount: 30, spentOn: today() });
    await reviewExpense(owner, mine.id, { decision: "approve" });
    await updateVendor(fm.ctx, v.id, { name: "Cloud Company" });
    await setVendorArchived(fm.ctx, v.id, true);
    expect(await listVendors(fm.ctx)).toEqual([]);
    await expect(createVendor(fm.ctx, { name: "cloud company" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("keeps finance away from people without finance access", async () => {
    const { org, ctx } = await createOrgWithOwner("fin-perm");
    const inv = await createDocument(ctx, "invoice", invoice());
    const emp = await addMember(org.id, "employee");
    const sales = await addMember(org.id, "sales_manager");
    for (const c of [emp.ctx, sales.ctx]) {
      await expect(listDocuments(c, { kind: "invoice" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getDocument(c, inv.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(createDocument(c, "invoice", invoice())).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(recordPayment(c, inv.id, { amount: 1, paidOn: today(), method: "cash" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listExpenses(c)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(createExpense(c, { description: "X", category: "other", amount: 1, spentOn: today() })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listVendors(c)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getFinanceOverview(c)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("never lets one organization read, change or link another's finance records", async () => {
    const a = await createOrgWithOwner("fin-victim");
    const b = await createOrgWithOwner("fin-attacker");
    const company = await createCompany(a.ctx, { name: "Victim Client" });
    const project = await createProject(a.ctx, { name: "Victim project" });
    const vendor = await createVendor(a.ctx, { name: "Victim vendor" });
    const inv = await createDocument(a.ctx, "invoice", invoice({ companyId: company.id, projectId: project.id }));
    await issueInvoice(a.ctx, inv.id);
    await recordPayment(a.ctx, inv.id, { amount: 5, paidOn: today(), method: "cash" });
    const pay = (await getDocument(a.ctx, inv.id)).payments[0];
    const est = await createDocument(a.ctx, "estimate", invoice());
    const exp = await createExpense(a.ctx, { description: "Victim expense", category: "rent", amount: 900, spentOn: today() });

    const x = b.ctx;
    expect(await listDocuments(x, { kind: "invoice" })).toEqual([]);
    expect(await listDocuments(x, { kind: "invoice", companyId: company.id })).toEqual([]);
    expect(await listExpenses(x)).toEqual([]);
    expect(await listVendors(x)).toEqual([]);
    for (const run of [
      () => getDocument(x, inv.id),
      () => updateDocument(x, est.id, invoice()),
      () => deleteDocument(x, est.id),
      () => issueInvoice(x, inv.id),
      () => voidInvoice(x, inv.id, {}),
      () => setEstimateStatus(x, est.id, { status: "accepted" }),
      () => convertEstimate(x, est.id),
      () => recordPayment(x, inv.id, { amount: 1, paidOn: today(), method: "cash" }),
      () => deletePayment(x, pay.id),
      () => updateExpense(x, exp.id, { description: "Mine", category: "other", amount: 1, spentOn: today() }),
      () => reviewExpense(x, exp.id, { decision: "approve" }),
      () => markExpensePaid(x, exp.id),
      () => deleteExpense(x, exp.id),
      () => updateVendor(x, vendor.id, { name: "Mine" }),
      () => setVendorArchived(x, vendor.id, true),
    ]) await expect(run()).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Links to the other organization's client, project or vendor are refused.
    await expect(createDocument(x, "invoice", invoice({ companyId: company.id }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createDocument(x, "invoice", invoice({ projectId: project.id }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createExpense(x, { description: "X", category: "other", amount: 1, spentOn: today(), vendorId: vendor.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    // The database refuses it as well, even if the service check were skipped.
    await expect(db()`insert into finance_document (organization_id, kind, number, bill_to_name, issue_date, currency, company_id)
      values (${b.org.id}, 'invoice', 99, 'X', now(), 'USD', ${company.id})`).rejects.toMatchObject({ code: "23503" });
    // Nothing of A's changed.
    const after = await getDocument(a.ctx, inv.id);
    expect(after).toMatchObject({ status: "issued", amountPaid: 5 });
    expect((await getFinanceOverview(x)).outstanding).toBe(0);
  });

  it("builds the overview from real records only", async () => {
    const { ctx } = await createOrgWithOwner("fin-report");
    const empty = await getFinanceOverview(ctx);
    expect(empty).toMatchObject({ outstanding: 0, overdue: 0, thisMonth: { income: 0, expenses: 0, net: 0 }, recentPayments: [], topClients: [] });
    expect(empty.months).toHaveLength(6);
    const late = await createDocument(ctx, "invoice", invoice({ issueDate: daysAgo(50), dueDate: daysAgo(45), lines: [{ description: "Old", quantity: 1, unitPrice: 300 }] }));
    const fresh = await createDocument(ctx, "invoice", invoice({ lines: [{ description: "New", quantity: 1, unitPrice: 200 }] }));
    await createDocument(ctx, "invoice", invoice()); // a draft doesn't count
    await issueInvoice(ctx, late.id);
    await issueInvoice(ctx, fresh.id);
    await recordPayment(ctx, fresh.id, { amount: 50, paidOn: today(), method: "online" });
    const e = await createExpense(ctx, { description: "Rent", category: "rent", amount: 80, spentOn: today() });
    await createExpense(ctx, { description: "Pending", category: "office", amount: 999, spentOn: today() });
    await reviewExpense(ctx, e.id, { decision: "approve" });
    const o = await getFinanceOverview(ctx);
    expect(o).toMatchObject({
      outstanding: 450, outstandingCount: 2, overdue: 300, overdueCount: 1, draftInvoices: 1,
      thisMonth: { income: 50, expenses: 80, net: -30 }, pendingExpenses: { count: 1, amount: 999 },
      byCategory: [{ category: "rent", amount: 80 }],
    });
    expect(o.aging.map((x) => x.amount)).toEqual([150, 0, 300, 0, 0]);
    expect(o.recentPayments).toEqual([expect.objectContaining({ number: "INV-0002", amount: 50, method: "online" })]);
  });
});
