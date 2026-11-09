"use server";
/**
 * Finance server actions. Each re-authenticates, re-resolves the workspace from
 * the slug (membership verified on the server), then calls the service, which
 * checks the permission for that exact operation and scopes every id to the
 * verified organization.
 */
import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import {
  convertEstimate, createDocument, deleteDocument, deletePayment, issueInvoice, recordPayment, setEstimateStatus, updateDocument, voidInvoice,
} from "@/server/finance/documents";
import { createExpense, deleteExpense, markExpensePaid, reviewExpense, updateExpense } from "@/server/finance/expenses";
import { createVendor, setVendorArchived, updateVendor } from "@/server/finance/vendors";
import { saveDocumentTemplate } from "@/server/finance/template";

async function ctxFor(slug: string) {
  const user = await requireUser();
  return resolveOrgContext(user.id, { slug: String(slug) });
}
const done = <T>(v: T) => { refresh(); return v; };
const kindOf = (k: unknown) => (k === "estimate" ? "estimate" : "invoice") as "invoice" | "estimate";

export async function createDocumentAction(slug: string, kind: string, input: unknown) {
  return runAction(async () => done(await createDocument(await ctxFor(slug), kindOf(kind), input)));
}
export async function updateDocumentAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateDocument(await ctxFor(slug), String(id), input)));
}
export async function deleteDocumentAction(slug: string, id: string) {
  return runAction(async () => done(await deleteDocument(await ctxFor(slug), String(id))));
}
export async function issueInvoiceAction(slug: string, id: string) {
  return runAction(async () => done(await issueInvoice(await ctxFor(slug), String(id))));
}
export async function voidInvoiceAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await voidInvoice(await ctxFor(slug), String(id), input)));
}
export async function setEstimateStatusAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await setEstimateStatus(await ctxFor(slug), String(id), input)));
}
export async function convertEstimateAction(slug: string, id: string) {
  return runAction(async () => done(await convertEstimate(await ctxFor(slug), String(id))));
}
export async function recordPaymentAction(slug: string, invoiceId: string, input: unknown) {
  return runAction(async () => done(await recordPayment(await ctxFor(slug), String(invoiceId), input)));
}
export async function deletePaymentAction(slug: string, id: string) {
  return runAction(async () => done(await deletePayment(await ctxFor(slug), String(id))));
}
export async function createExpenseAction(slug: string, input: unknown) {
  return runAction(async () => done(await createExpense(await ctxFor(slug), input)));
}
export async function updateExpenseAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateExpense(await ctxFor(slug), String(id), input)));
}
export async function reviewExpenseAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await reviewExpense(await ctxFor(slug), String(id), input)));
}
export async function markExpensePaidAction(slug: string, id: string) {
  return runAction(async () => done(await markExpensePaid(await ctxFor(slug), String(id))));
}
export async function deleteExpenseAction(slug: string, id: string) {
  return runAction(async () => done(await deleteExpense(await ctxFor(slug), String(id))));
}
export async function createVendorAction(slug: string, input: unknown) {
  return runAction(async () => done(await createVendor(await ctxFor(slug), input)));
}
export async function updateVendorAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateVendor(await ctxFor(slug), String(id), input)));
}
export async function setVendorArchivedAction(slug: string, id: string, archived: boolean) {
  return runAction(async () => done(await setVendorArchived(await ctxFor(slug), String(id), archived === true)));
}
export async function saveDocumentTemplateAction(slug: string, input: unknown) {
  return runAction(async () => done(await saveDocumentTemplate(await ctxFor(slug), input)));
}
