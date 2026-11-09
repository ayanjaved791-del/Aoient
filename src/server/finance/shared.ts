import "server-only";
import type { Db } from "@/server/database/client";
import { ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";

/**
 * Checks that ids sent from the browser name rows in this organization before
 * they're linked. The (organization_id, id) foreign keys refuse a cross-
 * organization link too; this gives a clear message first.
 */
async function assertOwn(tx: Db, table: "crm_company" | "project" | "finance_vendor", organizationId: string, id: string | null, field: string, what: string) {
  if (!id) return;
  const msg = `Pick a valid ${what}`;
  if (!isUuid(id)) throw new ValidationError(msg, { [field]: [msg] });
  const [row] = await tx`select 1 from ${tx(table)} where id = ${id} and organization_id = ${organizationId}`;
  if (!row) throw new ValidationError(msg, { [field]: [msg] });
}

export const assertOwnCompany = (tx: Db, org: string, id: string | null) => assertOwn(tx, "crm_company", org, id, "companyId", "client company");
export const assertOwnProject = (tx: Db, org: string, id: string | null) => assertOwn(tx, "project", org, id, "projectId", "project");
export const assertOwnVendor = (tx: Db, org: string, id: string | null) => assertOwn(tx, "finance_vendor", org, id, "vendorId", "vendor");

export type DocumentKind = "invoice" | "estimate";
export const docNumber = (kind: DocumentKind, n: number) => `${kind === "invoice" ? "INV" : "EST"}-${String(n).padStart(4, "0")}`;
export const KIND_LABEL: Record<DocumentKind, string> = { invoice: "Invoice", estimate: "Estimate" };
