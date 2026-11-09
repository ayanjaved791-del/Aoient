/**
 * The printed look of an invoice, estimate or payment receipt. Pure markup (no
 * server or browser APIs), so the document page and the Editor's live preview
 * render exactly the same thing.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, amount, day } from "./labels";

export interface DocumentTemplate {
  layout: "classic" | "modern" | "compact";
  accent: string;
  showLogo: boolean;
  businessName: string;
  businessAddress: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  taxId: string | null;
  invoiceTitle: string;
  estimateTitle: string;
  receiptTitle: string;
  defaultNotes: string | null;
  footer: string | null;
  defaultDueDays: number;
  defaultTaxRate: number;
}

export interface PaperLine { id: string; description: string; quantity: number; unitPrice: number; taxRate: number; amount: number }
export interface PaperDocument {
  kind: "invoice" | "estimate";
  number: string;
  issueDate: string;
  dueDate: string | null;
  billToName: string;
  billToEmail: string | null;
  billToAddress: string | null;
  currency: string;
  lines: PaperLine[];
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  notes: string | null;
}
export interface PaperReceipt { number: string; paidOn: string; method: string; reference: string | null; amount: number; balanceAfter: number }

/** Readable text on the accent colour. */
function onAccent(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}

function From({ t, logoUrl, invert }: { t: DocumentTemplate; logoUrl: string | null; invert?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-right">
      <div className="grid gap-0.5">
        <p className="text-base font-semibold">{t.businessName}</p>
        {t.businessAddress && <p className={cn("whitespace-pre-line text-sm", invert ? "opacity-80" : "text-muted-foreground")}>{t.businessAddress}</p>}
        {(t.businessEmail || t.businessPhone) && <p className={cn("text-sm", invert ? "opacity-80" : "text-muted-foreground")}>{[t.businessEmail, t.businessPhone].filter(Boolean).join(" · ")}</p>}
        {t.taxId && <p className={cn("text-xs", invert ? "opacity-80" : "text-muted-foreground")}>Tax no. {t.taxId}</p>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- the organization's own logo, served by the app */}
      {t.showLogo && logoUrl && <img src={logoUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />}
    </div>
  );
}

function Header({ t, logoUrl, title, number, facts, badge }: { t: DocumentTemplate; logoUrl: string | null; title: string; number: string; facts: [string, ReactNode][]; badge?: ReactNode }) {
  const modern = t.layout === "modern";
  const compact = t.layout === "compact";
  const fg = onAccent(t.accent);
  return (
    <div className={cn("[print-color-adjust:exact]", modern ? "-mx-6 -mt-6 px-6 py-7 sm:-mx-10 sm:-mt-10 sm:px-10 print:mx-0 print:mt-0 print:rounded-xl" : "")}
      style={modern ? { background: t.accent, color: fg } : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className={cn("text-xs font-semibold uppercase tracking-[0.2em]", modern ? "opacity-80" : "text-muted-foreground")} style={!modern ? { color: t.accent === "#0a0a0a" ? undefined : t.accent } : undefined}>{title}</p>
          <p className={cn("mt-1 font-semibold tracking-tight", compact ? "text-xl" : "text-3xl")}>{number}</p>
          {badge && <div className="mt-2 print:hidden">{badge}</div>}
        </div>
        <From t={t} logoUrl={logoUrl} invert={modern} />
      </div>
      <dl className={cn("mt-5 flex flex-wrap gap-x-8 gap-y-1 text-sm", compact && "mt-3")}>
        {facts.map(([k, v]) => <div key={k} className="flex gap-2"><dt className={modern ? "opacity-75" : "text-muted-foreground"}>{k}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>
    </div>
  );
}

function BillTo({ label, name, email, address }: { label: string; name: string; email: string | null; address: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{name}</p>
      {email && <p className="text-sm text-muted-foreground">{email}</p>}
      {address && <p className="whitespace-pre-line text-sm text-muted-foreground">{address}</p>}
    </div>
  );
}

function Footer({ t }: { t: DocumentTemplate }) {
  return t.footer ? <p className="mt-8 border-t border-border pt-4 text-center text-xs text-muted-foreground">{t.footer}</p> : null;
}

const pad = (t: DocumentTemplate) => (t.layout === "compact" ? "p-5 text-[13px] sm:p-7" : "p-6 sm:p-10");

export function DocumentPaper({ t, logoUrl, doc, badge, overdue }: { t: DocumentTemplate; logoUrl: string | null; doc: PaperDocument; badge?: ReactNode; overdue?: boolean }) {
  const compact = t.layout === "compact";
  const facts: [string, ReactNode][] = [["Date", day(doc.issueDate)]];
  if (doc.dueDate) facts.push([doc.kind === "invoice" ? "Due" : "Valid until", <span key="d" className={cn(overdue && "text-danger")}>{day(doc.dueDate)}</span>]);
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-xs print:border-0 print:shadow-none", pad(t))}>
      <Header t={t} logoUrl={logoUrl} title={doc.kind === "invoice" ? t.invoiceTitle : t.estimateTitle} number={doc.number} facts={facts} badge={badge} />
      <div className={cn(compact ? "mt-5" : "mt-8")}><BillTo label="Bill to" name={doc.billToName} email={doc.billToEmail} address={doc.billToAddress} /></div>
      <div className={cn("scroll-thin overflow-x-auto", compact ? "mt-5" : "mt-8")}>
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b-2 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ borderColor: t.accent }}>
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">Item</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Price</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Tax</th>
              <th scope="col" className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {doc.lines.map((l) => (
              <tr key={l.id}>
                <td className={cn("pr-4 [overflow-wrap:anywhere]", compact ? "py-2" : "py-3")}>{l.description}</td>
                <td className={cn("pr-4 text-right tabular-nums", compact ? "py-2" : "py-3")}>{l.quantity}</td>
                <td className={cn("whitespace-nowrap pr-4 text-right tabular-nums", compact ? "py-2" : "py-3")}>{amount(l.unitPrice, doc.currency)}</td>
                <td className={cn("pr-4 text-right tabular-nums text-muted-foreground", compact ? "py-2" : "py-3")}>{l.taxRate ? `${l.taxRate}%` : "—"}</td>
                <td className={cn("whitespace-nowrap text-right tabular-nums", compact ? "py-2" : "py-3")}>{amount(l.amount, doc.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto mt-4 grid w-full max-w-xs gap-1.5 border-t border-border pt-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{amount(doc.subtotal, doc.currency)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{amount(doc.taxTotal, doc.currency)}</dd></div>
        <div className="flex justify-between text-lg font-semibold" style={{ color: t.layout === "modern" ? undefined : t.accent === "#0a0a0a" ? undefined : t.accent }}><dt>Total</dt><dd className="tabular-nums">{amount(doc.total, doc.currency)}</dd></div>
        {doc.kind === "invoice" && doc.amountPaid > 0 && (
          <>
            <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd className="tabular-nums text-success">−{amount(doc.amountPaid, doc.currency)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Still owed</dt><dd className="tabular-nums">{amount(doc.balance, doc.currency)}</dd></div>
          </>
        )}
      </dl>
      {doc.notes && <p className={cn("whitespace-pre-line border-t border-border pt-4 text-sm text-muted-foreground", compact ? "mt-5" : "mt-8")}>{doc.notes}</p>}
      <Footer t={t} />
    </div>
  );
}

export function ReceiptPaper({ t, logoUrl, receipt, invoice }: { t: DocumentTemplate; logoUrl: string | null; receipt: PaperReceipt; invoice: Pick<PaperDocument, "number" | "billToName" | "billToEmail" | "billToAddress" | "currency" | "total"> }) {
  const c = invoice.currency;
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-xs print:border-0 print:shadow-none", pad(t))}>
      <Header t={t} logoUrl={logoUrl} title={t.receiptTitle} number={receipt.number} facts={[["Paid on", day(receipt.paidOn)], ["For invoice", invoice.number]]} />
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <BillTo label="Received from" name={invoice.billToName} email={invoice.billToEmail} address={invoice.billToAddress} />
        <div className="rounded-xl border-2 p-5 text-center [print-color-adjust:exact]" style={{ borderColor: t.accent }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount received</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{amount(receipt.amount, c)}</p>
        </div>
      </div>
      <dl className="mt-8 grid gap-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Payment method</dt><dd>{PAYMENT_METHOD_LABELS[receipt.method] ?? receipt.method}</dd></div>
        {receipt.reference && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Reference</dt><dd>{receipt.reference}</dd></div>}
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Invoice total</dt><dd className="tabular-nums">{amount(invoice.total, c)}</dd></div>
        <div className="flex justify-between gap-4 font-semibold"><dt>{receipt.balanceAfter > 0 ? "Still owed after this payment" : "Invoice status"}</dt><dd className="tabular-nums">{receipt.balanceAfter > 0 ? amount(receipt.balanceAfter, c) : "Paid in full"}</dd></div>
      </dl>
      <p className="mt-8 text-sm text-muted-foreground">Thank you for your payment.</p>
      <Footer t={t} />
    </div>
  );
}
