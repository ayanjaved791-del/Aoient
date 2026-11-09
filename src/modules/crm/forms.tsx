"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, STAGE_KIND_LABELS } from "./labels";
import {
  convertLeadAction, createCompanyAction, createContactAction, createDealAction, createLeadAction, createStageAction,
  setCompanyArchivedAction, setContactArchivedAction, setDealArchivedAction, setLeadArchivedAction,
  updateCompanyAction, updateContactAction, updateDealAction, updateLeadAction, updateStageAction,
} from "./actions";

type Opt = { id: string; name: string };
type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: { message: string; fields?: Record<string, string[]> } };
const CURRENCIES = ["USD", "EUR", "GBP", "PKR", "AED", "SAR", "INR", "CAD", "AUD"];

/** Shared state for a dialog form: open/close, field errors, a saving flag. */
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
  return { open, setOpen, onOpenChange, error, fields, saving, run, fe: (k: string) => fields[k]?.[0] };
}

const ownerOptions = (owners: Opt[]) => [{ value: "", label: "No owner" }, ...owners.map((o) => ({ value: o.id, label: o.name }))];

/* ─────────────────────────────── leads ─────────────────────────────── */

export interface LeadFormValue {
  id: string; fullName: string; email: string | null; phone: string | null; companyName: string | null;
  source: string; status: string; estimatedValue: number | null; ownerId: string | null;
}

export function LeadDialog({ slug, trigger, owners, lead, defaultOwnerId }: { slug: string; trigger: ReactNode; owners: Opt[]; lead?: LeadFormValue; defaultOwnerId?: string }) {
  const f = useDialogForm();
  const [v, setV] = useState({
    fullName: lead?.fullName ?? "", email: lead?.email ?? "", phone: lead?.phone ?? "", companyName: lead?.companyName ?? "",
    source: lead?.source ?? "website", status: lead?.status ?? "new", estimatedValue: lead?.estimatedValue?.toString() ?? "", ownerMemberId: lead?.ownerId ?? defaultOwnerId ?? "",
  });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => (lead ? updateLeadAction(slug, lead.id, v) : createLeadAction(slug, v)) as Promise<Result>, () => {
      toast.success(lead ? "Lead updated" : `${v.fullName} added to leads`);
      if (!lead) setV((s) => ({ ...s, fullName: "", email: "", phone: "", companyName: "", estimatedValue: "" }));
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{lead ? "Edit lead" : "New lead"}</DialogTitle><DialogDescription>Someone who might become a customer.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="lead-name" label="Name" error={f.fe("fullName")}><Input autoFocus value={v.fullName} onChange={(e) => set("fullName")(e.target.value)} maxLength={120} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="lead-email" label="Email (optional)" error={f.fe("email")}><Input type="email" value={v.email} onChange={(e) => set("email")(e.target.value)} /></Field>
            <Field id="lead-phone" label="Phone (optional)" error={f.fe("phone")}><Input value={v.phone} onChange={(e) => set("phone")(e.target.value)} maxLength={40} /></Field>
          </div>
          <Field id="lead-company" label="Company (optional)" error={f.fe("companyName")}><Input value={v.companyName} onChange={(e) => set("companyName")(e.target.value)} maxLength={120} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="lead-source" label="Source"><Select value={v.source} onValueChange={set("source")} options={Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({ value, label }))} /></Field>
            <Field id="lead-status" label="Status"><Select value={v.status} onValueChange={set("status")} options={["new", "contacted", "qualified", "disqualified"].map((value) => ({ value, label: LEAD_STATUS_LABELS[value] }))} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="lead-value" label="Estimated value (optional)" error={f.fe("estimatedValue")}><Input inputMode="decimal" value={v.estimatedValue} onChange={(e) => set("estimatedValue")(e.target.value)} placeholder="0" /></Field>
            <Field id="lead-owner" label="Owner" error={f.fe("owner")}><Select value={v.ownerMemberId} onValueChange={set("ownerMemberId")} options={ownerOptions(owners)} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{lead ? "Save" : "Add lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConvertLeadDialog({ slug, trigger, lead, canCreateDeal, currency, base }: {
  slug: string; trigger: ReactNode; lead: { id: string; fullName: string; companyName: string | null; estimatedValue: number | null }; canCreateDeal: boolean; currency: string; base: string;
}) {
  const f = useDialogForm();
  const router = useRouter();
  const [createDeal, setCreateDeal] = useState(canCreateDeal);
  const [title, setTitle] = useState(lead.companyName ? `${lead.companyName} deal` : `${lead.fullName} deal`);
  const [amount, setAmount] = useState(lead.estimatedValue?.toString() ?? "");
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => convertLeadAction(slug, lead.id, { createDeal, dealTitle: title, amount }) as Promise<Result<{ contactId: string; dealId: string | null }>>, (d) => {
      toast.success(d.dealId ? "Converted. The deal is in your pipeline." : "Converted to a contact");
      router.push(d.dealId ? `${base}/deals/${d.dealId}` : `${base}/contacts/${d.contactId}`);
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert {lead.fullName}</DialogTitle>
          <DialogDescription>Creates a contact{lead.companyName ? ` and the company ${lead.companyName}` : ""}. Existing records with the same email or company name are reused.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          {canCreateDeal && (
            <label className="flex items-center gap-2.5 text-sm"><Checkbox checked={createDeal} onCheckedChange={(c) => setCreateDeal(c === true)} />Also create a deal in the pipeline</label>
          )}
          {createDeal && (
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <Field id="conv-title" label="Deal name" error={f.fe("dealTitle")}><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} /></Field>
              <Field id="conv-amount" label={`Amount (${currency})`} error={f.fe("amount")}><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>Convert</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────── companies & contacts ─────────────────────────────── */

export interface CompanyFormValue { id: string; name: string; website: string | null; industry: string | null; phone: string | null; city: string | null; ownerId: string | null }

export function CompanyDialog({ slug, trigger, owners, company, defaultOwnerId }: { slug: string; trigger: ReactNode; owners: Opt[]; company?: CompanyFormValue; defaultOwnerId?: string }) {
  const f = useDialogForm();
  const [v, setV] = useState({ name: company?.name ?? "", website: company?.website ?? "", industry: company?.industry ?? "", phone: company?.phone ?? "", city: company?.city ?? "", ownerMemberId: company?.ownerId ?? defaultOwnerId ?? "" });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => (company ? updateCompanyAction(slug, company.id, v) : createCompanyAction(slug, v)) as Promise<Result>, () => {
      toast.success(company ? "Company updated" : `${v.name} added`);
      if (!company) setV((s) => ({ ...s, name: "", website: "", industry: "", phone: "", city: "" }));
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{company ? "Edit company" : "New company"}</DialogTitle><DialogDescription>A business you sell to or work with.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="co-name" label="Name" error={f.fe("name")}><Input autoFocus value={v.name} onChange={(e) => set("name")(e.target.value)} maxLength={120} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="co-industry" label="Industry (optional)" error={f.fe("industry")}><Input value={v.industry} onChange={(e) => set("industry")(e.target.value)} maxLength={80} /></Field>
            <Field id="co-city" label="City (optional)" error={f.fe("city")}><Input value={v.city} onChange={(e) => set("city")(e.target.value)} maxLength={80} /></Field>
            <Field id="co-web" label="Website (optional)" error={f.fe("website")}><Input value={v.website} onChange={(e) => set("website")(e.target.value)} maxLength={200} placeholder="example.com" /></Field>
            <Field id="co-phone" label="Phone (optional)" error={f.fe("phone")}><Input value={v.phone} onChange={(e) => set("phone")(e.target.value)} maxLength={40} /></Field>
          </div>
          <Field id="co-owner" label="Owner" error={f.fe("owner")}><Select value={v.ownerMemberId} onValueChange={set("ownerMemberId")} options={ownerOptions(owners)} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{company ? "Save" : "Add company"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface ContactFormValue { id: string; fullName: string; email: string | null; phone: string | null; jobTitle: string | null; companyId: string | null; ownerId: string | null }

export function ContactDialog({ slug, trigger, owners, companies, contact, defaultOwnerId, defaultCompanyId }: {
  slug: string; trigger: ReactNode; owners: Opt[]; companies: Opt[]; contact?: ContactFormValue; defaultOwnerId?: string; defaultCompanyId?: string;
}) {
  const f = useDialogForm();
  const [v, setV] = useState({ fullName: contact?.fullName ?? "", email: contact?.email ?? "", phone: contact?.phone ?? "", jobTitle: contact?.jobTitle ?? "", companyId: contact?.companyId ?? defaultCompanyId ?? "", ownerMemberId: contact?.ownerId ?? defaultOwnerId ?? "" });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => (contact ? updateContactAction(slug, contact.id, v) : createContactAction(slug, v)) as Promise<Result>, () => {
      toast.success(contact ? "Contact updated" : `${v.fullName} added`);
      if (!contact) setV((s) => ({ ...s, fullName: "", email: "", phone: "", jobTitle: "" }));
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle><DialogDescription>A person at a customer or partner.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="ct-name" label="Name" error={f.fe("fullName")}><Input autoFocus value={v.fullName} onChange={(e) => set("fullName")(e.target.value)} maxLength={120} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ct-email" label="Email (optional)" error={f.fe("email")}><Input type="email" value={v.email} onChange={(e) => set("email")(e.target.value)} /></Field>
            <Field id="ct-phone" label="Phone (optional)" error={f.fe("phone")}><Input value={v.phone} onChange={(e) => set("phone")(e.target.value)} maxLength={40} /></Field>
            <Field id="ct-title" label="Job title (optional)" error={f.fe("jobTitle")}><Input value={v.jobTitle} onChange={(e) => set("jobTitle")(e.target.value)} maxLength={80} /></Field>
            <Field id="ct-company" label="Company" error={f.fe("company")}><Select value={v.companyId} onValueChange={set("companyId")} options={[{ value: "", label: "No company" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
          </div>
          <Field id="ct-owner" label="Owner" error={f.fe("owner")}><Select value={v.ownerMemberId} onValueChange={set("ownerMemberId")} options={ownerOptions(owners)} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{contact ? "Save" : "Add contact"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────── deals ─────────────────────────────── */

export interface DealFormValue {
  id: string; title: string; stageId: string; amount: number; currency: string; expectedCloseDate: string | null;
  companyId: string | null; contactId: string | null; ownerId: string | null;
}

export function DealDialog({ slug, trigger, owners, companies, contacts, stages, deal, defaults, currency }: {
  slug: string; trigger: ReactNode; owners: Opt[]; companies: Opt[]; contacts: Opt[]; stages: Opt[]; currency: string;
  deal?: DealFormValue; defaults?: { stageId?: string; companyId?: string; contactId?: string; ownerId?: string };
}) {
  const f = useDialogForm();
  const router = useRouter();
  const [v, setV] = useState({
    title: deal?.title ?? "", stageId: deal?.stageId ?? defaults?.stageId ?? stages[0]?.id ?? "", amount: deal?.amount?.toString() ?? "", currency: deal?.currency ?? currency,
    expectedCloseDate: deal?.expectedCloseDate ?? "", companyId: deal?.companyId ?? defaults?.companyId ?? "", contactId: deal?.contactId ?? defaults?.contactId ?? "",
    ownerMemberId: deal?.ownerId ?? defaults?.ownerId ?? "",
  });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  const currencies = [...new Set([currency, v.currency, ...CURRENCIES])];
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => (deal ? updateDealAction(slug, deal.id, v) : createDealAction(slug, v)) as Promise<Result<{ id: string } | undefined>>, (d) => {
      toast.success(deal ? "Deal updated" : `${v.title} added to the pipeline`);
      if (!deal && d && "id" in d) router.refresh();
      if (!deal) setV((s) => ({ ...s, title: "", amount: "", expectedCloseDate: "" }));
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{deal ? "Edit deal" : "New deal"}</DialogTitle><DialogDescription>Work you hope to win, tracked through your pipeline.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="deal-title" label="Deal name" error={f.fe("title")}><Input autoFocus value={v.title} onChange={(e) => set("title")(e.target.value)} maxLength={140} placeholder="e.g. Website redesign" /></Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field id="deal-amount" label="Amount" error={f.fe("amount")}><Input inputMode="decimal" value={v.amount} onChange={(e) => set("amount")(e.target.value)} placeholder="0" /></Field>
            <Field id="deal-cur" label="Currency" error={f.fe("currency")}><Select value={v.currency} onValueChange={set("currency")} options={currencies.map((c) => ({ value: c, label: c }))} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="deal-stage" label="Stage" error={f.fe("stage")}><Select value={v.stageId} onValueChange={set("stageId")} options={stages.map((s) => ({ value: s.id, label: s.name }))} /></Field>
            <Field id="deal-close" label="Expected close (optional)" error={f.fe("expectedCloseDate")}><Input type="date" value={v.expectedCloseDate} onChange={(e) => set("expectedCloseDate")(e.target.value)} /></Field>
            <Field id="deal-company" label="Company" error={f.fe("company")}><Select value={v.companyId} onValueChange={set("companyId")} options={[{ value: "", label: "No company" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
            <Field id="deal-contact" label="Contact" error={f.fe("contact")}><Select value={v.contactId} onValueChange={set("contactId")} options={[{ value: "", label: "No contact" }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
          </div>
          <Field id="deal-owner" label="Owner" hint={deal ? undefined : "Leave empty to own it yourself."} error={f.fe("owner")}><Select value={v.ownerMemberId} onValueChange={set("ownerMemberId")} options={ownerOptions(owners)} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{deal ? "Save" : "Add deal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────── stages ─────────────────────────────── */

export function StageDialog({ slug, trigger, stage }: { slug: string; trigger: ReactNode; stage?: { id: string; name: string; kind: string; probability: number } }) {
  const f = useDialogForm();
  const [v, setV] = useState({ name: stage?.name ?? "", kind: stage?.kind ?? "open", probability: stage?.probability?.toString() ?? "" });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => (stage ? updateStageAction(slug, stage.id, v) : createStageAction(slug, v)) as Promise<Result>, () => {
      toast.success(stage ? "Stage updated" : `${v.name} added`);
      if (!stage) setV({ name: "", kind: "open", probability: "" });
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{stage ? "Edit stage" : "New stage"}</DialogTitle><DialogDescription>Deals in a won or lost stage count as closed.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="st-name" label="Name" error={f.fe("name")}><Input autoFocus value={v.name} onChange={(e) => set("name")(e.target.value)} maxLength={40} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="st-kind" label="Type"><Select value={v.kind} onValueChange={set("kind")} options={Object.entries(STAGE_KIND_LABELS).map(([value, label]) => ({ value, label }))} /></Field>
            <Field id="st-prob" label="Chance to win (%)" hint="Used for the weighted forecast." error={f.fe("probability")}><Input inputMode="numeric" value={v.probability} onChange={(e) => set("probability")(e.target.value)} placeholder={v.kind === "won" ? "100" : v.kind === "lost" ? "0" : "50"} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{stage ? "Save" : "Add stage"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────── archive ─────────────────────────────── */

const ARCHIVE = { lead: setLeadArchivedAction, contact: setContactArchivedAction, company: setCompanyArchivedAction, deal: setDealArchivedAction } as const;

export function ArchiveButton({ slug, kind, id, name, archived, after }: { slug: string; kind: keyof typeof ARCHIVE; id: string; name: string; archived: boolean; after?: string }) {
  const router = useRouter();
  if (archived) {
    return (
      <Button variant="secondary" onClick={async () => {
        const res = await ARCHIVE[kind](slug, id, false);
        if (res.ok) toast.success(`${name} restored`); else toast.error(res.error.message);
      }}><ArchiveRestore />Restore</Button>
    );
  }
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" className="text-muted-foreground hover:text-danger"><Archive />Archive</Button>}
      title={`Archive ${name}?`}
      description="It's hidden from lists and the pipeline. Nothing is deleted, and you can restore it from the archived view."
      confirmLabel="Archive"
      onConfirm={async () => {
        const res = await ARCHIVE[kind](slug, id, true);
        if (!res.ok) { toast.error(res.error.message); return false; }
        toast.success(`${name} archived`);
        if (after) router.push(after);
      }}
    />
  );
}
