import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildReceiptPdf } from "@/server/billing/receipt-pdf";
import type { PaidTransaction } from "@/server/billing/paddle-transactions";

const base: PaidTransaction = {
  id: "txn_01hv8x9q2k3m4n5p6r7s8t9v0w", planName: "Indiana", interval: "monthly", total: "$94.01", tax: "$15.02",
  email: "owner@example.com", invoiceNumber: "325-10566", billedAt: "2026-11-07T10:00:00Z", subtotal: "$78.99", currency: "USD",
  customerName: "Owner Name", address: "1 Main St, London, GB", business: { name: "Studio Ltd", taxId: "GB123" },
  paymentMethod: "Visa •••• 4242", period: { startsAt: "2026-11-07T10:00:00Z", endsAt: "2026-12-07T10:00:00Z" },
  lineItems: [{ name: "Indiana", quantity: 1, amount: "$78.99" }],
  trial: null,
  organizationId: null,
};

describe("PDF receipt", () => {
  it("renders a one-page A4 PDF with receipt metadata", async () => {
    const bytes = await buildReceiptPdf(base);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Aoient receipt 325-10566");
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });

  it("handles missing optional details and characters the PDF fonts can't draw", async () => {
    const bytes = await buildReceiptPdf({
      ...base, invoiceNumber: null, customerName: "علی Ayan 李", address: null, business: null, paymentMethod: null, period: null, lineItems: [],
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe(`Aoient receipt ${base.id.slice(-10).toUpperCase()}`);
  });
});
