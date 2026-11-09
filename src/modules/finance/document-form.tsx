"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { computeTotals } from "@/lib/validation/finance";
import { amount as fmt, CURRENCIES } from "./labels";
import { createDocumentAction, updateDocumentAction } from "./actions";

type Opt = { id: string; name: string };
type Line = { key: number; description: string; quantity: string; unitPrice: string; taxRate: string };
export interface DocumentFormValue {
  id: string; billToName: string; billToEmail: string | null; billToAddress: string | null; companyId: string | null; projectId: string | null;
  issueDate: string; dueDate: string | null; currency: string; notes: string | null;
  lines: { description: string; quantity: number; unitPrice: number; taxRate: number }[];
}

const toNum = (s: string) => { const n = Number(String(s).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
let keySeq = 1;

/** The invoice / estimate editor: who it's for, the items, live totals. Totals are recomputed on the server. */
export function DocumentForm({ slug, kind, base, currency, today, companies, projects, doc, defaults }: {
  slug: string; kind: "invoice" | "estimate"; base: string; currency: string; today: string;
  /** From Finance → Editor: due-date days, tax rate and notes for new documents. */
  defaults?: { dueDays: number; taxRate: number; notes: string | null };
  companies: Opt[]; projects: (Opt & { companyId: string | null })[]; doc?: DocumentFormValue;
}) {
  const router = useRouter();
  const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const [v, setV] = useState({
    billToName: doc?.billToName ?? "", billToEmail: doc?.billToEmail ?? "", billToAddress: doc?.billToAddress ?? "",
    companyId: doc?.companyId ?? "", projectId: doc?.projectId ?? "", issueDate: doc?.issueDate ?? today,
    dueDate: doc ? doc.dueDate ?? "" : addDays(today, defaults?.dueDays ?? (kind === "invoice" ? 14 : 30)), currency: doc?.currency ?? currency, notes: doc ? doc.notes ?? "" : defaults?.notes ?? "",
  });
  const [lines, setLines] = useState<Line[]>(
    doc?.lines.length
      ? doc.lines.map((l) => ({ key: keySeq++, description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPrice), taxRate: String(l.taxRate) }))
      : [{ key: keySeq++, description: "", quantity: "1", unitPrice: "", taxRate: String(defaults?.taxRate ?? 0) }],
  );
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  const setLine = (key: number, k: keyof Omit<Line, "key">, val: string) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [k]: val } : l)));
  const fe = (k: string) => fields[k]?.[0];
  const totals = computeTotals(lines.map((l) => ({ quantity: toNum(l.quantity), unitPrice: toNum(l.unitPrice), taxRate: toNum(l.taxRate) })));
  const label = kind === "invoice" ? "invoice" : "estimate";

  function pickCompany(id: string) {
    const c = companies.find((x) => x.id === id);
    setV((s) => ({ ...s, companyId: id, billToName: c && (!s.billToName || companies.some((x) => x.name === s.billToName)) ? c.name : s.billToName }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null); setFields({}); setSaving(true);
    const payload = { ...v, lines: lines.map(({ description, quantity, unitPrice, taxRate }) => ({ description, quantity, unitPrice, taxRate: taxRate || "0" })) };
    const res = doc ? await updateDocumentAction(slug, doc.id, payload) : await createDocumentAction(slug, kind, payload);
    setSaving(false);
    if (!res.ok) { setFields(res.error.fields ?? {}); setError(res.error.message); return; }
    const id = doc ? doc.id : (res.data as { id: string; number: string }).id;
    toast.success(doc ? "Saved" : `${(res.data as { number: string }).number} created as a draft`);
    router.push(`${base}/${id}`);
  }

  const shownProjects = v.companyId ? projects.filter((p) => !p.companyId || p.companyId === v.companyId) : projects;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      {error && <Alert tone="danger" title={error} />}
      <Card className="grid gap-5 p-5 sm:p-6">
        <h2 className="text-base font-semibold">Bill to</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {companies.length > 0 && (
            <Field id="doc-company" label="Client company (optional)" error={fe("companyId")}>
              <Select value={v.companyId} onValueChange={pickCompany} options={[{ value: "", label: "Not linked to the CRM" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} />
            </Field>
          )}
          <Field id="doc-name" label="Name on the document" error={fe("billToName")}>
            <Input value={v.billToName} onChange={(e) => set("billToName")(e.target.value)} maxLength={160} placeholder="Client or company name" />
          </Field>
          <Field id="doc-email" label="Email (optional)" error={fe("billToEmail")}>
            <Input type="email" value={v.billToEmail} onChange={(e) => set("billToEmail")(e.target.value)} />
          </Field>
          {projects.length > 0 && (
            <Field id="doc-project" label="Project (optional)" error={fe("projectId")}>
              <Select value={v.projectId} onValueChange={set("projectId")} options={[{ value: "", label: "No project" }, ...shownProjects.map((p) => ({ value: p.id, label: p.name }))]} />
            </Field>
          )}
          <Field id="doc-address" label="Address (optional)" error={fe("billToAddress")} className="md:col-span-2">
            <Textarea rows={2} value={v.billToAddress} onChange={(e) => set("billToAddress")(e.target.value)} maxLength={500} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="doc-issue" label={kind === "invoice" ? "Invoice date" : "Estimate date"} error={fe("issueDate")}>
            <Input type="date" value={v.issueDate} onChange={(e) => set("issueDate")(e.target.value)} />
          </Field>
          <Field id="doc-due" label={kind === "invoice" ? "Due date (optional)" : "Valid until (optional)"} error={fe("dueDate")}>
            <Input type="date" value={v.dueDate} min={v.issueDate} onChange={(e) => set("dueDate")(e.target.value)} />
          </Field>
          <Field id="doc-currency" label="Currency" error={fe("currency")}>
            <Select value={v.currency} onValueChange={set("currency")} options={[...new Set([currency, ...CURRENCIES, v.currency])].map((c) => ({ value: c, label: c }))} />
          </Field>
        </div>
      </Card>

      <Card className="grid gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Items</h2>
          {fe("lines") && <p className="text-sm text-danger">{fe("lines")}</p>}
        </div>
        <div className="hidden grid-cols-[minmax(0,1fr)_88px_120px_80px_120px_36px] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
          <span>Description</span><span>Qty</span><span>Price</span><span>Tax %</span><span className="text-right">Amount</span><span />
        </div>
        <ul className="grid gap-3">
          {lines.map((l, i) => (
            <li key={l.key} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_88px_120px_80px_120px_36px] md:items-start md:border-0 md:p-0">
              <div className="col-span-2 md:col-span-1">
                <Input aria-label={`Item ${i + 1} description`} placeholder="What you're charging for" value={l.description} maxLength={300}
                  aria-invalid={fe(`lines.${i}.description`) ? true : undefined} onChange={(e) => setLine(l.key, "description", e.target.value)} />
                {fe(`lines.${i}.description`) && <p className="mt-1 text-xs text-danger">{fe(`lines.${i}.description`)}</p>}
              </div>
              <label className="grid gap-1 text-xs text-muted-foreground md:block"><span className="md:sr-only">Quantity</span>
                <Input inputMode="decimal" aria-label={`Item ${i + 1} quantity`} value={l.quantity} aria-invalid={fe(`lines.${i}.quantity`) ? true : undefined} onChange={(e) => setLine(l.key, "quantity", e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground md:block"><span className="md:sr-only">Price</span>
                <Input inputMode="decimal" aria-label={`Item ${i + 1} price`} placeholder="0.00" value={l.unitPrice} aria-invalid={fe(`lines.${i}.unitPrice`) ? true : undefined} onChange={(e) => setLine(l.key, "unitPrice", e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground md:block"><span className="md:sr-only">Tax %</span>
                <Input inputMode="decimal" aria-label={`Item ${i + 1} tax rate`} value={l.taxRate} aria-invalid={fe(`lines.${i}.taxRate`) ? true : undefined} onChange={(e) => setLine(l.key, "taxRate", e.target.value)} />
              </label>
              <p className="self-center text-right text-sm font-medium tabular-nums">{fmt(totals.amounts[i] ?? 0, v.currency)}</p>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${i + 1}`} disabled={lines.length === 1}
                className="justify-self-end text-muted-foreground hover:text-danger" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 /></Button>
            </li>
          ))}
        </ul>
        <div>
          <Button type="button" variant="secondary" disabled={lines.length >= 100}
            onClick={() => setLines((ls) => [...ls, { key: keySeq++, description: "", quantity: "1", unitPrice: "", taxRate: ls.at(-1)?.taxRate ?? "0" }])}><Plus />Add item</Button>
        </div>
        <dl className="ml-auto grid w-full max-w-xs gap-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{fmt(totals.subtotal, v.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{fmt(totals.taxTotal, v.currency)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{fmt(totals.total, v.currency)}</dd></div>
        </dl>
      </Card>

      <Card className="p-5 sm:p-6">
        <Field id="doc-notes" label="Notes for the client (optional)" hint="Payment details, terms or a thank-you. Printed on the document." error={fe("notes")}>
          <Textarea rows={3} value={v.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={2000} />
        </Field>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={saving}>{doc ? "Save changes" : `Save ${label} as draft`}</Button>
      </div>
    </form>
  );
}
