import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { parseInput } from "@/lib/validation/parse";
import { templateSchema } from "@/lib/validation/finance";
import type { DocumentTemplate } from "@/modules/finance/document-paper";

export const DEFAULT_TEMPLATE: Omit<DocumentTemplate, "businessName"> = {
  layout: "classic", accent: "#0a0a0a", showLogo: true, businessAddress: null, businessEmail: null, businessPhone: null, taxId: null,
  invoiceTitle: "Invoice", estimateTitle: "Estimate", receiptTitle: "Payment receipt", defaultNotes: null, footer: null, defaultDueDays: 14, defaultTaxRate: 0,
};

/** How this organization's documents look. Defaults until someone saves the editor. */
export async function getDocumentTemplate(ctx: OrgContext): Promise<DocumentTemplate & { saved: boolean }> {
  assertPermission(ctx, "finance.invoice.read");
  const [r] = await getDb()<{
    layout: DocumentTemplate["layout"]; accent: string; show_logo: boolean; business_name: string | null; business_address: string | null; business_email: string | null;
    business_phone: string | null; tax_id: string | null; invoice_title: string; estimate_title: string; receipt_title: string; default_notes: string | null;
    footer: string | null; default_due_days: number; default_tax_rate: string;
  }[]>`select * from finance_template where organization_id = ${ctx.organizationId}`;
  if (!r) return { ...DEFAULT_TEMPLATE, businessName: ctx.organization.name, saved: false };
  return {
    layout: r.layout, accent: r.accent, showLogo: r.show_logo, businessName: r.business_name ?? ctx.organization.name, businessAddress: r.business_address,
    businessEmail: r.business_email, businessPhone: r.business_phone, taxId: r.tax_id, invoiceTitle: r.invoice_title, estimateTitle: r.estimate_title,
    receiptTitle: r.receipt_title, defaultNotes: r.default_notes, footer: r.footer, defaultDueDays: r.default_due_days, defaultTaxRate: Number(r.default_tax_rate), saved: true,
  };
}

export async function saveDocumentTemplate(ctx: OrgContext, input: unknown): Promise<void> {
  assertPermission(ctx, "finance.invoice.issue");
  const t = parseInput(templateSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const row = {
      organization_id: ctx.organizationId, layout: t.layout, accent: t.accent.toLowerCase(), show_logo: t.showLogo, business_name: t.businessName,
      business_address: t.businessAddress, business_email: t.businessEmail, business_phone: t.businessPhone, tax_id: t.taxId, invoice_title: t.invoiceTitle,
      estimate_title: t.estimateTitle, receipt_title: t.receiptTitle, default_notes: t.defaultNotes, footer: t.footer, default_due_days: t.defaultDueDays,
      default_tax_rate: t.defaultTaxRate, updated_by_id: ctx.userId,
    };
    await tx`insert into finance_template ${tx(row)}
      on conflict (organization_id) do update set ${tx(row, Object.keys(row).filter((k) => k !== "organization_id") as (keyof typeof row)[])}, updated_at = now()`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "finance.template_updated", targetType: "finance_template", metadata: { layout: t.layout } });
  });
}
