"use client";
import { useState, type FormEvent } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { workingDays } from "@/lib/validation/people";
import { cancelLeaveAction, decideLeaveAction, requestLeaveAction } from "./actions";

import { LEAVE_LABELS } from "./labels";

export function LeaveStatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "warning" | "success" | "danger" | "neutral"; label: string }> = {
    pending: { tone: "warning", label: "Pending" },
    approved: { tone: "success", label: "Approved" },
    rejected: { tone: "danger", label: "Declined" },
    cancelled: { tone: "neutral", label: "Cancelled" },
  };
  const m = map[status] ?? map.pending;
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/** Today, or the next Monday when today is a weekend, as a sensible first leave day. */
const firstWorkingDay = () => {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function RequestLeaveDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("annual");
  const [start, setStart] = useState(firstWorkingDay);
  const [end, setEnd] = useState(firstWorkingDay);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const days = end >= start ? (halfDay ? 0.5 : workingDays(start, end)) : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({}); setFormError(null); setSaving(true);
    const res = await requestLeaveAction(slug, { type, startDate: start, endDate: halfDay ? start : end, halfDay, reason });
    setSaving(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(Object.fromEntries(Object.entries(res.error.fields).map(([k, m]) => [k, m[0]])));
      setFormError(res.error.message);
      return;
    }
    toast.success(`Leave requested (${res.data.days} ${res.data.days === 1 ? "day" : "days"}). You'll see the decision here.`);
    setOpen(false); setReason("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setErrors({}); setFormError(null); }}>
      <DialogTrigger asChild><Button><CalendarPlus />Request leave</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>Your request goes to HR and admins for approval. Weekends aren&apos;t counted.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {formError && <Alert tone="danger" title={formError} />}
          <Field id="leave-type" label="Type" error={errors.type}>
            <Select value={type} onValueChange={setType} options={Object.entries(LEAVE_LABELS).map(([value, label]) => ({ value, label }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="leave-start" label="From" error={errors.startDate}><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} /></Field>
            <Field id="leave-end" label="To" error={errors.endDate}><Input type="date" value={halfDay ? start : end} min={start} disabled={halfDay} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={halfDay} onCheckedChange={(v) => setHalfDay(v === true)} />Half day</label>
          <Field id="leave-reason" label="Reason (optional)" hint="Only you, HR and approvers can see this." error={errors.reason}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
            {days > 0 ? <><span className="font-semibold">{days}</span> working {days === 1 ? "day" : "days"}</> : "Pick at least one working day (Mon–Fri)."}
          </p>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={days <= 0}>Send request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DecideLeaveButtons({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [busy, setBusy] = useState<null | "approved" | "rejected">(null);
  const [note, setNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    const res = await decideLeaveAction(slug, id, { decision, note });
    setBusy(null);
    if (res.ok) { toast.success(decision === "approved" ? `Approved ${name}'s leave` : `Declined ${name}'s leave`); setRejectOpen(false); }
    else toast.error(res.error.message);
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" loading={busy === "approved"} onClick={() => decide("approved")}><Check />Approve</Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild><Button size="sm" variant="secondary"><X />Decline</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Decline {name}&apos;s leave?</DialogTitle><DialogDescription>Add a short note so they know why (optional).</DialogDescription></DialogHeader>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. We're short-staffed that week, can you move it?" />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>Back</Button>
            <Button variant="destructive" loading={busy === "rejected"} onClick={() => decide("rejected")}>Decline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CancelLeaveButton({ slug, id }: { slug: string; id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="ghost" loading={busy} className="text-muted-foreground hover:text-danger" onClick={async () => {
      setBusy(true);
      const res = await cancelLeaveAction(slug, id);
      setBusy(false);
      if (res.ok) toast.success("Leave request cancelled"); else toast.error(res.error.message);
    }}>Cancel</Button>
  );
}
