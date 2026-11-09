"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DocumentPaper, ReceiptPaper, type DocumentTemplate } from "./document-paper";
import { saveDocumentTemplateAction } from "./actions";

const SWATCHES = ["#0a0a0a", "#1d4ed8", "#0f766e", "#15803d", "#b45309", "#be123c", "#7c3aed", "#475569"];
const LAYOUTS: { value: DocumentTemplate["layout"]; label: string; hint: string }[] = [
  { value: "classic", label: "Classic", hint: "Clean, white, a coloured line" },
  { value: "modern", label: "Modern", hint: "A bold colour band on top" },
  { value: "compact", label: "Compact", hint: "Tighter, fits more on a page" },
];
type Preview = "invoice" | "estimate" | "receipt";

/**
 * Finance → Editor: how invoices, estimates and receipts look, with a live
 * preview on sample data. Saved per organization; every document uses it.
 */
export function TemplateEditor({ slug, initial, defaults, logoUrl, currency, today, settingsHref }: {
  slug: string; initial: DocumentTemplate; defaults: DocumentTemplate; logoUrl: string | null; currency: string; today: string; settingsHref: string | null;
}) {
  const [t, setT] = useState<DocumentTemplate>(initial);
  const [saved, setSaved] = useState<DocumentTemplate>(initial);
  const [preview, setPreview] = useState<Preview>("invoice");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(t) !== JSON.stringify(saved);
  const set = <K extends keyof DocumentTemplate>(k: K) => (v: DocumentTemplate[K]) => setT((s) => ({ ...s, [k]: v }));
  const txt = (k: keyof DocumentTemplate) => (e: { target: { value: string } }) => setT((s) => ({ ...s, [k]: e.target.value }));
  const fe = (k: string) => fields[k]?.[0];

  const sample = useMemo(() => {
    const lines = [
      { id: "1", description: "Website design and build", quantity: 1, unitPrice: 2500, taxRate: t.defaultTaxRate, amount: 2500 },
      { id: "2", description: "Content pages", quantity: 6, unitPrice: 85, taxRate: t.defaultTaxRate, amount: 510 },
    ];
    const sub = 3010, tax = Math.round(sub * t.defaultTaxRate) / 100;
    const due = new Date(`${today}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + t.defaultDueDays);
    return { lines, sub, tax, total: sub + tax, due: due.toISOString().slice(0, 10) };
  }, [t.defaultTaxRate, t.defaultDueDays, today]);

  async function save() {
    setError(null); setFields({}); setSaving(true);
    const res = await saveDocumentTemplateAction(slug, t);
    setSaving(false);
    if (!res.ok) { setError(res.error.message); setFields(res.error.fields ?? {}); return; }
    setSaved(t);
    toast.success("Saved. Every invoice, estimate and receipt now uses this look.");
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="grid min-w-0 content-start gap-4">
        {error && <Alert tone="danger" title={error} />}
        <Card className="grid gap-4 p-5">
          <h2 className="text-sm font-semibold">Layout</h2>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Layout">
            {LAYOUTS.map((l) => (
              <button key={l.value} type="button" role="radio" aria-checked={t.layout === l.value} onClick={() => set("layout")(l.value)}
                className={cn("grid gap-2 rounded-lg border p-2 text-left transition-colors", t.layout === l.value ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40")}>
                <span aria-hidden className="grid h-14 gap-1 rounded-md border border-border bg-surface p-1.5">
                  {l.value === "modern" ? <span className="h-4 rounded-sm" style={{ background: t.accent }} /> : <span className="h-1.5 w-1/2 rounded-sm bg-muted-foreground/40" />}
                  <span className="h-1 w-3/4 rounded-sm bg-surface-muted" /><span className="h-1 w-2/3 rounded-sm bg-surface-muted" />
                  {l.value !== "modern" && <span className="h-0.5 rounded-sm" style={{ background: t.accent }} />}
                </span>
                <span className="text-xs font-semibold">{l.label}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{l.hint}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Colour</p>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={t.accent.toLowerCase() === c} onClick={() => set("accent")(c)}
                  className="grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-primary" style={{ background: c }}>
                  {t.accent.toLowerCase() === c && <Check className="size-4 text-white" aria-hidden />}
                </button>
              ))}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="color" value={t.accent} onChange={(e) => set("accent")(e.target.value)} aria-label="Custom colour" className="size-8 cursor-pointer rounded-full border border-border bg-transparent" />Custom
              </label>
            </div>
            {fe("accent") && <p className="text-xs text-danger">{fe("accent")}</p>}
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox checked={t.showLogo} onCheckedChange={(c) => set("showLogo")(c === true)} />Show the organization logo
          </label>
          {t.showLogo && !logoUrl && (
            <p className="text-xs text-muted-foreground">No logo uploaded yet.{settingsHref && <> Add one in <Link href={settingsHref} className="font-medium text-foreground hover:underline">General settings</Link>.</>}</p>
          )}
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="text-sm font-semibold">Your business on the document</h2>
          <Field id="tpl-name" label="Business name" error={fe("businessName")}><Input value={t.businessName} onChange={txt("businessName")} maxLength={160} /></Field>
          <Field id="tpl-address" label="Address (optional)" error={fe("businessAddress")}><Textarea rows={2} value={t.businessAddress ?? ""} onChange={txt("businessAddress")} maxLength={500} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="tpl-email" label="Email (optional)" error={fe("businessEmail")}><Input type="email" value={t.businessEmail ?? ""} onChange={txt("businessEmail")} /></Field>
            <Field id="tpl-phone" label="Phone (optional)" error={fe("businessPhone")}><Input value={t.businessPhone ?? ""} onChange={txt("businessPhone")} maxLength={40} /></Field>
          </div>
          <Field id="tpl-tax" label="Tax or registration number (optional)" hint="For example your NTN or VAT number." error={fe("taxId")}><Input value={t.taxId ?? ""} onChange={txt("taxId")} maxLength={60} /></Field>
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="text-sm font-semibold">Wording</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="tpl-inv" label="Invoice title" error={fe("invoiceTitle")}><Input value={t.invoiceTitle} onChange={txt("invoiceTitle")} maxLength={40} placeholder="Invoice" /></Field>
            <Field id="tpl-est" label="Estimate title" error={fe("estimateTitle")}><Input value={t.estimateTitle} onChange={txt("estimateTitle")} maxLength={40} placeholder="Estimate" /></Field>
            <Field id="tpl-rec" label="Receipt title" error={fe("receiptTitle")}><Input value={t.receiptTitle} onChange={txt("receiptTitle")} maxLength={40} placeholder="Payment receipt" /></Field>
          </div>
          <Field id="tpl-footer" label="Footer (optional)" hint="Printed at the bottom of every document." error={fe("footer")}><Input value={t.footer ?? ""} onChange={txt("footer")} maxLength={300} placeholder="Thank you for your business" /></Field>
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="text-sm font-semibold">Defaults for new documents</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="tpl-due" label="Invoice due after (days)" error={fe("defaultDueDays")}><Input inputMode="numeric" value={String(t.defaultDueDays)} onChange={(e) => set("defaultDueDays")(Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
            <Field id="tpl-taxrate" label="Tax rate (%)" error={fe("defaultTaxRate")}><Input inputMode="decimal" value={String(t.defaultTaxRate)} onChange={(e) => set("defaultTaxRate")(Number(e.target.value) || 0)} /></Field>
          </div>
          <Field id="tpl-notes" label="Notes for the client (optional)" hint="Bank details, payment terms. Filled in on each new invoice and estimate; you can still change them there." error={fe("defaultNotes")}>
            <Textarea rows={3} value={t.defaultNotes ?? ""} onChange={txt("defaultNotes")} maxLength={2000} placeholder={"Bank: Meezan Bank\nAccount: 0123-4567890"} />
          </Field>
        </Card>

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
          <Button onClick={save} loading={saving} disabled={!dirty}><Save />Save</Button>
          <Button variant="secondary" disabled={!dirty || saving} onClick={() => setT(saved)}>Undo changes</Button>
          <Button variant="ghost" disabled={saving} onClick={() => setT({ ...defaults, businessName: t.businessName })}><RotateCcw />Default look</Button>
          <span className="ml-auto text-xs text-muted-foreground">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        </div>
      </div>

      <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        <div role="tablist" aria-label="Preview" className="mb-3 inline-flex rounded-lg border border-border bg-surface p-0.5">
          {(["invoice", "estimate", "receipt"] as const).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={preview === p} onClick={() => setPreview(p)}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors", preview === p ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-surface-muted")}>{p}</button>
          ))}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Live preview with sample data. Your real documents use your clients and items.</p>
        <div className="origin-top">
          {preview === "receipt" ? (
            <ReceiptPaper t={t} logoUrl={logoUrl} receipt={{ number: "INV-0001-R1", paidOn: today, method: "bank_transfer", reference: "TX-48213", amount: 1000, balanceAfter: Math.max(0, sample.total - 1000) }}
              invoice={{ number: "INV-0001", billToName: "Hunza Travels", billToEmail: "accounts@hunza.example", billToAddress: "Karimabad, Hunza", currency, total: sample.total }} />
          ) : (
            <DocumentPaper t={t} logoUrl={logoUrl}
              doc={{ kind: preview, number: preview === "invoice" ? "INV-0001" : "EST-0001", issueDate: today, dueDate: sample.due, billToName: "Hunza Travels", billToEmail: "accounts@hunza.example",
                billToAddress: "Karimabad, Hunza", currency, lines: sample.lines, subtotal: sample.sub, taxTotal: sample.tax, total: sample.total, amountPaid: 0, balance: sample.total, notes: t.defaultNotes }} />
          )}
        </div>
      </div>
    </div>
  );
}
