"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Ban, Check, CircleDollarSign, FileOutput, Printer, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CURRENCIES, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, amount as fmt } from "./labels";
import {
  convertEstimateAction, createExpenseAction, createVendorAction, deleteDocumentAction, deleteExpenseAction, deletePaymentAction, issueInvoiceAction,
  markExpensePaidAction, recordPaymentAction, reviewExpenseAction, setEstimateStatusAction, setVendorArchivedAction, updateExpenseAction,
  updateVendorAction, voidInvoiceAction,
} from "./actions";

type Opt = { id: string; name: string };
type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: { message: string; fields?: Record<string, string[]> } };

function useDialogForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  async function run<T>(fn: () => Promise<Result<T>>, ok: (data: T) => void) {
    setError(null); setFields({}); setSaving(true);
    const res = await fn();
    setSaving(false);
    if (!res.ok) { setFields(res.error.fields ?? {}); setError(res.error.message); return; }
    ok(res.data);
    setOpen(false);
  }
  const onOpenChange = (o: boolean) => { setOpen(o); setError(null); setFields({}); };
  return { open, setOpen, onOpenChange, error, saving, run, fe: (k: string) => fields[k]?.[0] };
}

/** Runs a one-click action and reports the result. */
async function act(fn: () => Promise<Result>, ok: string): Promise<boolean> {
  const res = await fn();
  if (!res.ok) { toast.error(res.error.message); return false; }
  toast.success(ok);
  return true;
}

/* ─────────────────────────────── documents ─────────────────────────────── */

export function PrintButton() {
  return <Button variant="secondary" onClick={() => window.print()}><Printer />Print or save PDF</Button>;
}

export function IssueInvoiceButton({ slug, id, number }: { slug: string; id: string; number: string }) {
  return (
    <ConfirmDialog trigger={<Button><Send />Issue invoice</Button>} title={`Issue ${number}?`} destructive={false} confirmLabel="Issue"
      description="It becomes final: the items and amounts can't be changed afterwards, and you can start recording payments. Send it to your client yourself (print or save it as a PDF)."
      onConfirm={() => act(() => issueInvoiceAction(slug, id), `${number} issued`)} />
  );
}

export function VoidInvoiceButton({ slug, id, number }: { slug: string; id: string; number: string }) {
  const f = useDialogForm();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild><Button variant="ghost" className="text-muted-foreground hover:text-danger"><Ban />Void</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Void {number}?</DialogTitle><DialogDescription>It stays on record as void and no longer counts as money owed. This can&apos;t be undone.</DialogDescription></DialogHeader>
        <form noValidate className="grid gap-4" onSubmit={(e) => { e.preventDefault(); f.run(() => voidInvoiceAction(slug, id, { reason }) as Promise<Result>, () => toast.success(`${number} voided`)); }}>
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="void-reason" label="Reason (optional)" error={f.fe("reason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Sent to the wrong client" /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="destructive" loading={f.saving}>Void invoice</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDocumentButton({ slug, id, number, after }: { slug: string; id: string; number: string; after: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog trigger={<Button variant="ghost" className="text-muted-foreground hover:text-danger"><Trash2 />Delete</Button>} title={`Delete ${number}?`}
      description="The draft and its items are removed for good. Its number isn't reused." confirmLabel="Delete"
      onConfirm={async () => { if (!(await act(() => deleteDocumentAction(slug, id), `${number} deleted`))) return false; router.push(after); }} />
  );
}

export function EstimateActions({ slug, id, number, status, canIssue, canConvert, invoicesBase }: {
  slug: string; id: string; number: string; status: string; canIssue: boolean; canConvert: boolean; invoicesBase: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const mark = async (s: string, msg: string) => { setBusy(s); await act(() => setEstimateStatusAction(slug, id, { status: s }), msg); setBusy(null); };
  return (
    <>
      {canIssue && status === "draft" && <Button loading={busy === "sent"} onClick={() => mark("sent", `${number} marked as sent`)}><Send />Mark as sent</Button>}
      {canIssue && status === "sent" && (
        <>
          <Button loading={busy === "accepted"} onClick={() => mark("accepted", `${number} accepted`)}><Check />Accepted</Button>
          <Button variant="secondary" loading={busy === "declined"} onClick={() => mark("declined", `${number} marked as declined`)}><X />Declined</Button>
        </>
      )}
      {canIssue && status === "declined" && <Button variant="secondary" loading={busy === "draft"} onClick={() => mark("draft", `${number} reopened as a draft`)}>Reopen</Button>}
      {canConvert && status === "accepted" && (
        <Button loading={busy === "convert"} onClick={async () => {
          setBusy("convert");
          const res = await convertEstimateAction(slug, id);
          setBusy(null);
          if (!res.ok) { toast.error(res.error.message); return; }
          toast.success(`${res.data.number} created from ${number}`);
          router.push(`${invoicesBase}/${res.data.id}`);
        }}><FileOutput />Turn into invoice</Button>
      )}
    </>
  );
}

export function PaymentDialog({ slug, invoiceId, number, owed, currency, today, minDate }: { slug: string; invoiceId: string; number: string; owed: number; currency: string; today: string; minDate: string }) {
  const f = useDialogForm();
  const [v, setV] = useState({ amount: owed.toFixed(2), paidOn: today, method: "bank_transfer", reference: "", notes: "" });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => recordPaymentAction(slug, invoiceId, v) as Promise<Result<{ paid: boolean }>>, (d) => toast.success(d.paid ? `${number} is paid in full` : "Payment recorded"));
  }
  return (
    <Dialog open={f.open} onOpenChange={(o) => { f.onOpenChange(o); if (o) setV((s) => ({ ...s, amount: owed.toFixed(2) })); }}>
      <DialogTrigger asChild><Button><CircleDollarSign />Record payment</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record a payment</DialogTitle><DialogDescription>Money your client paid against {number}. {fmt(owed, currency)} is still owed.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pay-amount" label={`Amount (${currency})`} error={f.fe("amount")}><Input inputMode="decimal" autoFocus value={v.amount} onChange={(e) => set("amount")(e.target.value)} /></Field>
            <Field id="pay-date" label="Paid on" error={f.fe("paidOn")}><Input type="date" value={v.paidOn} min={minDate} onChange={(e) => set("paidOn")(e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pay-method" label="Method"><Select value={v.method} onValueChange={set("method")} options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))} /></Field>
            <Field id="pay-ref" label="Reference (optional)" error={f.fe("reference")}><Input value={v.reference} onChange={(e) => set("reference")(e.target.value)} maxLength={120} placeholder="Transaction ID" /></Field>
          </div>
          <Field id="pay-notes" label="Notes (optional)" error={f.fe("notes")}><Input value={v.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={500} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>Record payment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePaymentButton({ slug, id, label }: { slug: string; id: string; label: string }) {
  return (
    <ConfirmDialog trigger={<Button variant="ghost" size="icon-sm" aria-label={`Remove payment of ${label}`} className="text-muted-foreground hover:text-danger"><Trash2 /></Button>}
      title="Remove this payment?" description={`${label} comes off the invoice, which shows as owed again.`} confirmLabel="Remove"
      onConfirm={() => act(() => deletePaymentAction(slug, id), "Payment removed")} />
  );
}

/* ─────────────────────────────── expenses ─────────────────────────────── */

export interface ExpenseFormValue { id: string; description: string; category: string; amount: number; currency: string; spentOn: string; vendorId: string | null; projectId: string | null; notes: string | null }

export function ExpenseDialog({ slug, trigger, currency, today, vendors, projects, expense }: {
  slug: string; trigger: ReactNode; currency: string; today: string; vendors: Opt[]; projects: Opt[]; expense?: ExpenseFormValue;
}) {
  const f = useDialogForm();
  const [v, setV] = useState({
    description: expense?.description ?? "", category: expense?.category ?? "software", amount: expense?.amount.toFixed(2) ?? "", currency: expense?.currency ?? currency,
    spentOn: expense?.spentOn ?? today, vendorId: expense?.vendorId ?? "", projectId: expense?.projectId ?? "", notes: expense?.notes ?? "",
  });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => (expense ? updateExpenseAction(slug, expense.id, v) : createExpenseAction(slug, v)) as Promise<Result>, () => {
      toast.success(expense ? "Expense updated and sent for approval again" : "Expense added. It's waiting for approval.");
      if (!expense) setV((s) => ({ ...s, description: "", amount: "", notes: "" }));
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{expense ? "Edit expense" : "New expense"}</DialogTitle><DialogDescription>Money the business spent. Someone with approval rights reviews it.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="exp-desc" label="What was it for?" error={f.fe("description")}><Input autoFocus value={v.description} onChange={(e) => set("description")(e.target.value)} maxLength={200} placeholder="Laptop for the design team" /></Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
            <Field id="exp-amount" label="Amount" error={f.fe("amount")}><Input inputMode="decimal" value={v.amount} onChange={(e) => set("amount")(e.target.value)} placeholder="0.00" /></Field>
            <Field id="exp-cur" label="Currency" error={f.fe("currency")}><Select value={v.currency} onValueChange={set("currency")} options={[...new Set([currency, ...CURRENCIES, v.currency])].map((c) => ({ value: c, label: c }))} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="exp-cat" label="Category"><Select value={v.category} onValueChange={set("category")} options={Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} /></Field>
            <Field id="exp-date" label="Date" error={f.fe("spentOn")}><Input type="date" value={v.spentOn} max={today} onChange={(e) => set("spentOn")(e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="exp-vendor" label="Vendor (optional)" error={f.fe("vendorId")}><Select value={v.vendorId} onValueChange={set("vendorId")} options={[{ value: "", label: "No vendor" }, ...vendors.map((x) => ({ value: x.id, label: x.name }))]} /></Field>
            {projects.length > 0 && <Field id="exp-project" label="Project (optional)" error={f.fe("projectId")}><Select value={v.projectId} onValueChange={set("projectId")} options={[{ value: "", label: "No project" }, ...projects.map((x) => ({ value: x.id, label: x.name }))]} /></Field>}
          </div>
          <Field id="exp-notes" label="Notes (optional)" error={f.fe("notes")}><Textarea rows={2} value={v.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={1000} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{expense ? "Save" : "Add expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewExpense({ slug, id, description }: { slug: string; id: string; description: string }) {
  const f = useDialogForm();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-1.5">
      <Button size="sm" loading={busy} onClick={async () => { setBusy(true); await act(() => reviewExpenseAction(slug, id, { decision: "approve" }), "Expense approved"); setBusy(false); }}><Check />Approve</Button>
      <Dialog open={f.open} onOpenChange={f.onOpenChange}>
        <DialogTrigger asChild><Button size="sm" variant="secondary"><X />Reject</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject this expense?</DialogTitle><DialogDescription>{description}. Whoever added it can correct it and send it again.</DialogDescription></DialogHeader>
          <form noValidate className="grid gap-4" onSubmit={(e) => { e.preventDefault(); f.run(() => reviewExpenseAction(slug, id, { decision: "reject", note }) as Promise<Result>, () => toast.success("Expense rejected")); }}>
            {f.error && <Alert tone="danger" title={f.error} />}
            <Field id={`rej-${id}`} label="Why? (optional)" error={f.fe("note")}><Input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Please attach the receipt" /></Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" loading={f.saving}>Reject</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MarkExpensePaid({ slug, id }: { slug: string; id: string }) {
  const [busy, setBusy] = useState(false);
  return <Button size="sm" variant="secondary" loading={busy} onClick={async () => { setBusy(true); await act(() => markExpensePaidAction(slug, id), "Marked as paid out"); setBusy(false); }}><CircleDollarSign />Mark paid</Button>;
}

export function DeleteExpenseButton({ slug, id, description }: { slug: string; id: string; description: string }) {
  return (
    <ConfirmDialog trigger={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${description}`} className="text-muted-foreground hover:text-danger"><Trash2 /></Button>}
      title="Delete this expense?" description={`${description} is removed for good.`} confirmLabel="Delete"
      onConfirm={() => act(() => deleteExpenseAction(slug, id), "Expense deleted")} />
  );
}

/* ─────────────────────────────── vendors ─────────────────────────────── */

export interface VendorFormValue { id: string; name: string; email: string | null; phone: string | null; taxId: string | null; notes: string | null }

export function VendorDialog({ slug, trigger, vendor }: { slug: string; trigger: ReactNode; vendor?: VendorFormValue }) {
  const f = useDialogForm();
  const [v, setV] = useState({ name: vendor?.name ?? "", email: vendor?.email ?? "", phone: vendor?.phone ?? "", taxId: vendor?.taxId ?? "", notes: vendor?.notes ?? "" });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => (vendor ? updateVendorAction(slug, vendor.id, v) : createVendorAction(slug, v)) as Promise<Result>, () => {
      toast.success(vendor ? "Vendor updated" : `${v.name} added`);
      if (!vendor) setV({ name: "", email: "", phone: "", taxId: "", notes: "" });
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{vendor ? "Edit vendor" : "New vendor"}</DialogTitle><DialogDescription>A supplier or service you pay.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="ven-name" label="Name" error={f.fe("name")}><Input autoFocus value={v.name} onChange={(e) => set("name")(e.target.value)} maxLength={120} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ven-email" label="Email (optional)" error={f.fe("email")}><Input type="email" value={v.email} onChange={(e) => set("email")(e.target.value)} /></Field>
            <Field id="ven-phone" label="Phone (optional)" error={f.fe("phone")}><Input value={v.phone} onChange={(e) => set("phone")(e.target.value)} maxLength={40} /></Field>
          </div>
          <Field id="ven-tax" label="Tax or registration number (optional)" error={f.fe("taxId")}><Input value={v.taxId} onChange={(e) => set("taxId")(e.target.value)} maxLength={60} /></Field>
          <Field id="ven-notes" label="Notes (optional)" error={f.fe("notes")}><Textarea rows={2} value={v.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={1000} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{vendor ? "Save" : "Add vendor"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VendorArchiveButton({ slug, id, name, archived }: { slug: string; id: string; name: string; archived: boolean }) {
  if (archived) {
    return <Button size="sm" variant="secondary" onClick={() => act(() => setVendorArchivedAction(slug, id, false), `${name} restored`)}><ArchiveRestore />Restore</Button>;
  }
  return (
    <ConfirmDialog trigger={<Button variant="ghost" size="icon-sm" aria-label={`Archive ${name}`} className="text-muted-foreground hover:text-danger"><Archive /></Button>}
      title={`Archive ${name}?`} description="It's hidden from lists and can't be picked for new expenses. Past expenses keep it." confirmLabel="Archive"
      onConfirm={() => act(() => setVendorArchivedAction(slug, id, true), `${name} archived`)} />
  );
}
