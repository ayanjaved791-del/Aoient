/**
 * Aoient-branded PDF payment receipt, drawn with pdf-lib (vector, no headless
 * browser). Content comes only from a transaction confirmed by Paddle's API.
 *
 * Paddle is the merchant of record, so the official tax invoice is Paddle's;
 * the receipt says so.
 *
 * No `server-only` import so unit tests can render it.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { PaidTransaction } from "./paddle-transactions";

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // page margin

const C = {
  navy: rgb(16 / 255, 24 / 255, 40 / 255),
  violet: rgb(124 / 255, 58 / 255, 237 / 255),
  fuchsia: rgb(217 / 255, 70 / 255, 239 / 255),
  orange: rgb(251 / 255, 146 / 255, 60 / 255),
  green: rgb(18 / 255, 183 / 255, 106 / 255),
  greenSubtle: rgb(236 / 255, 253 / 255, 243 / 255),
  text: rgb(16 / 255, 24 / 255, 40 / 255),
  muted: rgb(102 / 255, 112 / 255, 133 / 255),
  border: rgb(228 / 255, 231 / 255, 236 / 255),
  surface: rgb(249 / 255, 250 / 255, 251 / 255),
  white: rgb(1, 1, 1),
};

const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "—";

export async function buildReceiptPdf(t: PaidTransaction, opts: { generatedAt?: Date } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const receiptNo = t.invoiceNumber ?? t.id.slice(-10).toUpperCase();
  doc.setTitle(`Aoient receipt ${receiptNo}`);
  doc.setAuthor("Aoient");
  doc.setSubject(`Payment receipt for the ${t.planName} plan`);
  doc.setCreator("Aoient");
  doc.setProducer("Aoient");

  const page = doc.addPage([A4.w, A4.h]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const p = new Painter(page, regular);

  // ── Header band ──
  const bandH = 168;
  page.drawRectangle({ x: 0, y: A4.h - bandH, width: A4.w, height: bandH, color: C.navy });
  // Soft colour glows (layered translucent circles).
  for (const [x, y, r, c, o] of [
    [A4.w - 40, A4.h - 10, 150, C.violet, 0.35],
    [A4.w - 150, A4.h - 150, 110, C.fuchsia, 0.18],
    [A4.w - 10, A4.h - 140, 80, C.orange, 0.18],
  ] as [number, number, number, RGB, number][]) {
    page.drawCircle({ x, y, size: r, color: c, opacity: o });
  }
  // Trim the glows to the band (pdf-lib has no clipping): repaint the page below it.
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h - bandH, color: C.white });
  page.drawRectangle({ x: 0, y: A4.h - bandH, width: A4.w, height: 3, color: C.violet });
  drawLogo(page, M, A4.h - 52, 34);
  p.text("Aoient", M + 44, A4.h - 64, { font: bold, size: 20, color: C.white });
  p.text("One platform. Your entire business.", M, A4.h - 100, { size: 10, color: rgb(0.78, 0.8, 0.86) });

  p.text("RECEIPT", A4.w - M, A4.h - 58, { font: bold, size: 11, color: rgb(0.78, 0.8, 0.86), align: "right", spacing: 2 });
  p.text(receiptNo, A4.w - M, A4.h - 80, { font: bold, size: 16, color: C.white, align: "right" });
  p.text(fmtDate(t.billedAt), A4.w - M, A4.h - 98, { size: 10, color: rgb(0.78, 0.8, 0.86), align: "right" });

  // ── Amount + PAID ──
  let y = A4.h - bandH - 54;
  p.text("Amount paid", M, y, { size: 10, color: C.muted });
  p.text(t.total, M, y - 34, { font: bold, size: 30 });
  const amountW = bold.widthOfTextAtSize(p.safe(t.total, bold), 30);
  pill(page, M + amountW + 14, y - 30, "PAID", bold);
  p.text(`${t.planName} plan${t.interval ? ` · ${t.interval === "yearly" ? "Yearly" : "Monthly"}` : ""} · paid ${fmtDate(t.billedAt)}`, M, y - 56, {
    size: 10,
    color: C.muted,
  });

  // ── Billed to / Details ──
  y -= 96;
  const colW = (A4.w - M * 2 - 24) / 2;
  const billed = [t.customerName, t.email, t.business?.name, t.business?.taxId ? `Tax ID: ${t.business.taxId}` : null, t.address].filter(
    (v): v is string => Boolean(v),
  );
  const details: [string, string][] = [
    ["Receipt number", receiptNo],
    ["Date paid", fmtDate(t.billedAt)],
    ["Payment method", t.paymentMethod ?? "—"],
    ...(t.period ? ([["Billing period", `${fmtShort(t.period.startsAt)} – ${fmtShort(t.period.endsAt)}`]] as [string, string][]) : []),
  ];
  const boxH = Math.max(billed.length * 15 + 40, details.length * 17 + 40);
  card(page, M, y - boxH, colW, boxH);
  card(page, M + colW + 24, y - boxH, colW, boxH);
  p.text("BILLED TO", M + 16, y - 22, { font: bold, size: 8, color: C.muted, spacing: 1.2 });
  billed.forEach((line, i) =>
    p.text(line, M + 16, y - 40 - i * 15, { font: i === 0 ? bold : regular, size: 10, maxWidth: colW - 32 }),
  );
  const dx = M + colW + 24 + 16;
  p.text("DETAILS", dx, y - 22, { font: bold, size: 8, color: C.muted, spacing: 1.2 });
  details.forEach(([k, v], i) => {
    p.text(k, dx, y - 40 - i * 17, { size: 9, color: C.muted });
    p.text(v, dx + colW - 32, y - 40 - i * 17, { size: 9, align: "right", maxWidth: colW - 110 });
  });

  // ── Items ──
  y -= boxH + 34;
  const tableW = A4.w - M * 2;
  page.drawRectangle({ x: M, y: y - 8, width: tableW, height: 26, color: C.surface, borderColor: C.border, borderWidth: 0.75 });
  p.text("DESCRIPTION", M + 14, y + 1, { font: bold, size: 8, color: C.muted, spacing: 1.2 });
  p.text("QTY", M + tableW - 140, y + 1, { font: bold, size: 8, color: C.muted, spacing: 1.2, align: "right" });
  p.text("AMOUNT", M + tableW - 14, y + 1, { font: bold, size: 8, color: C.muted, spacing: 1.2, align: "right" });
  const items = t.lineItems.length ? t.lineItems : [{ name: `${t.planName} plan`, quantity: 1, amount: t.subtotal }];
  y -= 30;
  for (const item of items) {
    p.text(`${item.name}${/plan$/i.test(item.name) ? "" : " plan"} subscription`, M + 14, y, { font: bold, size: 10, maxWidth: tableW - 200 });
    const sub = [t.interval ? (t.interval === "yearly" ? "Billed yearly" : "Billed monthly") : null, t.period ? `${fmtDate(t.period.startsAt)} – ${fmtDate(t.period.endsAt)}` : null]
      .filter(Boolean)
      .join(" · ");
    if (sub) p.text(sub, M + 14, y - 14, { size: 8.5, color: C.muted });
    p.text(String(item.quantity), M + tableW - 140, y, { size: 10, align: "right" });
    p.text(item.amount, M + tableW - 14, y, { size: 10, align: "right" });
    y -= 36;
    page.drawLine({ start: { x: M, y: y + 14 }, end: { x: M + tableW, y: y + 14 }, thickness: 0.75, color: C.border });
  }

  // ── Totals ──
  const tx = M + tableW - 220;
  const rows: [string, string, boolean][] = [
    ["Subtotal", t.subtotal, false],
    ["Tax", t.tax, false],
    ["Total", t.total, true],
  ];
  rows.forEach(([k, v, strong], i) => {
    p.text(k, tx, y - i * 20, { font: strong ? bold : regular, size: strong ? 11 : 10, color: strong ? C.text : C.muted });
    p.text(v, M + tableW - 14, y - i * 20, { font: strong ? bold : regular, size: strong ? 11 : 10, align: "right" });
  });
  y -= rows.length * 20 + 6;
  page.drawRectangle({ x: tx - 12, y: y - 10, width: 220 + 12, height: 30, color: C.greenSubtle });
  p.text("Amount paid", tx, y, { font: bold, size: 11, color: C.green });
  p.text(`${t.total} ${t.currency}`, M + tableW - 14, y, { font: bold, size: 11, color: C.green, align: "right" });

  // ── Merchant of record note ──
  y -= 60;
  card(page, M, y - 48, tableW, 58);
  p.text("About this receipt", M + 16, y - 6, { font: bold, size: 9.5 });
  p.text(
    "Payments for Aoient are processed by Paddle, our merchant of record. Paddle issues the official tax invoice for this",
    M + 16,
    y - 22,
    { size: 8.5, color: C.muted },
  );
  p.text("purchase and emails it to you. This receipt confirms the payment and lists what it covers.", M + 16, y - 34, {
    size: 8.5,
    color: C.muted,
  });

  // ── Footer ──
  page.drawLine({ start: { x: M, y: 70 }, end: { x: A4.w - M, y: 70 }, thickness: 0.75, color: C.border });
  p.text("Thank you for choosing Aoient.", M, 50, { font: bold, size: 10 });
  p.text(`Transaction ${t.id}`, M, 36, { font: mono, size: 7.5, color: C.muted });
  p.text(`Generated ${fmtDate((opts.generatedAt ?? new Date()).toISOString())}`, A4.w - M, 50, { size: 8.5, color: C.muted, align: "right" });
  p.text("aoient.com", A4.w - M, 36, { size: 8.5, color: C.violet, align: "right" });

  return doc.save();
}

/** The A·I·O monogram from the site logo, in white on a light circle. */
function drawLogo(page: PDFPage, x: number, yTop: number, size: number) {
  const s = size / 100;
  page.drawCircle({ x: x + size / 2, y: yTop - size / 2, size: size / 2, color: C.white });
  const stroke = { borderColor: C.navy, borderWidth: 5, scale: s, borderLineCap: 1 as const };
  page.drawSvgPath("M28 82 L50 16 L72 82", { x, y: yTop, ...stroke });
  page.drawSvgPath("M50 10 V82", { x, y: yTop, ...stroke });
  page.drawSvgPath("M31 66 H69", { x, y: yTop, ...stroke });
  page.drawCircle({ x: x + 50 * s, y: yTop - 66 * s, size: 6.5 * s, borderColor: C.navy, borderWidth: 5 * s, color: C.white });
}

function pill(page: PDFPage, x: number, y: number, label: string, font: PDFFont) {
  const w = font.widthOfTextAtSize(label, 9) + 22;
  page.drawRectangle({ x, y: y - 3, width: w, height: 20, color: C.greenSubtle, borderColor: C.green, borderWidth: 0.75 });
  page.drawCircle({ x: x + 9, y: y + 7, size: 2.6, color: C.green });
  page.drawText(label, { x: x + 15, y: y + 3.5, size: 9, font, color: C.green });
}

function card(page: PDFPage, x: number, y: number, w: number, h: number) {
  page.drawRectangle({ x, y, width: w, height: h, color: C.surface, borderColor: C.border, borderWidth: 0.75 });
}

class Painter {
  constructor(
    private page: PDFPage,
    private regular: PDFFont,
  ) {}

  /** Standard PDF fonts only cover Western European characters; anything else becomes "?". */
  safe(text: string, font: PDFFont): string {
    let out = "";
    for (const ch of text) {
      try {
        font.encodeText(ch);
        out += ch;
      } catch {
        out += "?";
      }
    }
    return out;
  }

  text(
    raw: string,
    x: number,
    y: number,
    o: { font?: PDFFont; size?: number; color?: RGB; align?: "left" | "right"; spacing?: number; maxWidth?: number } = {},
  ) {
    const font = o.font ?? this.regular;
    const size = o.size ?? 10;
    let text = this.safe(raw, font);
    if (o.maxWidth) {
      while (text.length > 1 && font.widthOfTextAtSize(text, size) > o.maxWidth) text = text.slice(0, -2) + "…";
    }
    const spacing = o.spacing ?? 0;
    const width = font.widthOfTextAtSize(text, size) + spacing * Math.max(0, text.length - 1);
    const startX = o.align === "right" ? x - width : x;
    if (!spacing) {
      this.page.drawText(text, { x: startX, y, size, font, color: o.color ?? C.text });
      return;
    }
    let cx = startX;
    for (const ch of text) {
      this.page.drawText(ch, { x: cx, y, size, font, color: o.color ?? C.text });
      cx += font.widthOfTextAtSize(ch, size) + spacing;
    }
  }
}
