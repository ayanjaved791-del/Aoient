"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Pencil, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { checkInAction, checkOutAction, clearAttendanceAction, correctAttendanceAction, saveAttendanceSettingAction } from "./attendance-actions";
import { hours } from "./attendance-format";

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: { message: string; fields?: Record<string, string[]> } };


export function AttendanceBadge({ status, late }: { status: string; late?: boolean }) {
  const map: Record<string, { tone: "success" | "warning" | "danger" | "neutral" | "primary"; label: string }> = {
    present: { tone: "success", label: "Present" },
    half_day: { tone: "warning", label: "Half day" },
    absent: { tone: "danger", label: "Absent" },
    leave: { tone: "primary", label: "On leave" },
    none: { tone: "neutral", label: "Not recorded" },
  };
  const m = map[status] ?? map.none;
  return <span className="inline-flex gap-1"><Badge tone={m.tone}>{m.label}</Badge>{late && <Badge tone="warning">Late</Badge>}</span>;
}

/** Live clock-in card for the person themselves. */
export function CheckInCard({ slug, checkIn, checkOut, minutes, startsAt, date }: { slug: string; checkIn: string | null; checkOut: string | null; minutes: number | null; startsAt: string; date: string }) {
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  async function run(fn: () => Promise<Result<{ at: string; minutes?: number }>>, msg: (d: { at: string; minutes?: number }) => string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { toast.error(res.error.message); return; }
    toast.success(msg(res.data));
    router.refresh();
  }
  const state = checkOut ? "done" : checkIn ? "in" : "out";
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums" suppressHydrationWarning>{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state === "out" && `You haven't checked in yet. The day starts at ${startsAt}.`}
          {state === "in" && `Checked in at ${checkIn}. Don't forget to check out when you finish.`}
          {state === "done" && `Done for today: ${checkIn} – ${checkOut} (${hours(minutes)}).`}
        </p>
      </div>
      {state === "out" && <Button size="lg" loading={busy} onClick={() => run(() => checkInAction(slug, {}), (d) => `Checked in at ${d.at}`)}><LogIn />Check in</Button>}
      {state === "in" && <Button size="lg" variant="secondary" loading={busy} onClick={() => run(() => checkOutAction(slug, {}), (d) => `Checked out at ${d.at} · ${hours(d.minutes ?? 0)} today`)}><LogOut />Check out</Button>}
    </div>
  );
}

export function CorrectDialog({ slug, employeeId, name, date, current }: {
  slug: string; employeeId: string; name: string; date: string; current: { status: string; checkIn: string | null; checkOut: string | null; note: string | null };
}) {
  const [open, setOpen] = useState(false);
  const start = ["present", "half_day", "absent"].includes(current.status) ? current.status : "present";
  const [v, setV] = useState({ status: start, checkIn: current.checkIn ?? "", checkOut: current.checkOut ?? "", note: current.note ?? "" });
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setFields({});
    const res = await correctAttendanceAction(slug, { employeeId, workDate: date, ...v });
    setSaving(false);
    if (!res.ok) { setError(res.error.message); setFields(res.error.fields ?? {}); return; }
    toast.success(`${name}'s day saved`);
    setOpen(false);
  }
  const absent = v.status === "absent";
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); setFields({}); }}>
      <DialogTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Correct ${name}'s day`}><Pencil /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>Set what happened on {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}. Times are in the workspace&apos;s time zone. The change is logged.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {error && <Alert tone="danger" title={error} />}
          <Field id={`st-${employeeId}`} label="Status"><Select value={v.status} onValueChange={(s) => setV((x) => ({ ...x, status: s }))} options={[{ value: "present", label: "Present" }, { value: "half_day", label: "Half day" }, { value: "absent", label: "Absent" }]} /></Field>
          {!absent && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`in-${employeeId}`} label="Check in" error={fields.checkIn?.[0]}><Input type="time" value={v.checkIn} onChange={(e) => setV((x) => ({ ...x, checkIn: e.target.value }))} /></Field>
              <Field id={`out-${employeeId}`} label="Check out (optional)" error={fields.checkOut?.[0]}><Input type="time" value={v.checkOut} onChange={(e) => setV((x) => ({ ...x, checkOut: e.target.value }))} /></Field>
            </div>
          )}
          <Field id={`note-${employeeId}`} label="Note (optional)" error={fields.note?.[0]}><Input value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} maxLength={300} placeholder="Forgot to check out" /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClearDayButton({ slug, id, name }: { slug: string; id: string; name: string }) {
  return (
    <ConfirmDialog trigger={<Button variant="ghost" size="icon-sm" aria-label={`Clear ${name}'s day`} className="text-muted-foreground hover:text-danger"><Trash2 /></Button>}
      title={`Clear ${name}'s record for this day?`} description="The day goes back to “Not recorded”. This is logged." confirmLabel="Clear"
      onConfirm={async () => { const r = await clearAttendanceAction(slug, id); if (!r.ok) toast.error(r.error.message); else toast.success("Record cleared"); }} />
  );
}

export function AttendanceSettingsDialog({ slug, workStarts, graceMinutes }: { slug: string; workStarts: string; graceMinutes: number }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ workStarts, graceMinutes: String(graceMinutes) });
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setFields({});
    const res = await saveAttendanceSettingAction(slug, v);
    setSaving(false);
    if (!res.ok) { setFields(res.error.fields ?? {}); toast.error(res.error.message); return; }
    toast.success("Working hours saved");
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary"><Settings2 />Working hours</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Working hours</DialogTitle><DialogDescription>Check-ins after the start time plus the grace period are marked late.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="att-start" label="Day starts at" error={fields.workStarts?.[0]}><Input type="time" value={v.workStarts} onChange={(e) => setV((x) => ({ ...x, workStarts: e.target.value }))} /></Field>
            <Field id="att-grace" label="Grace period (minutes)" error={fields.graceMinutes?.[0]}><Input inputMode="numeric" value={v.graceMinutes} onChange={(e) => setV((x) => ({ ...x, graceMinutes: e.target.value }))} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Date / month picker that navigates on change. */
export function PeriodPicker({ type, value, max, param, base }: { type: "date" | "month"; value: string; max: string; param: string; base: string }) {
  const router = useRouter();
  return (
    <Input type={type} value={value} max={max} aria-label={type === "date" ? "Day" : "Month"} className="w-auto"
      onChange={(e) => { if (e.target.value) router.push(`${base}${base.includes("?") ? "&" : "?"}${param}=${e.target.value}`); }} />
  );
}
