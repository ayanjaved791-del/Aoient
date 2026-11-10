"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pause, Play, Plus, Receipt, Send, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMinutes } from "@/lib/validation/time";
import { cn } from "@/lib/utils";
import {
  billProjectHoursAction, createEntryAction, deleteEntryAction, discardTimerAction, reviewTimesheetAction, startTimerAction, stopTimerAction,
  submitWeekAction, updateEntryAction, withdrawWeekAction,
} from "./actions";

export type Work = { id: string; name: string; tasks: { id: string; title: string }[] }[];
type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: { message: string; fields?: Record<string, string[]> } };

async function act(fn: () => Promise<Result>, ok: string): Promise<boolean> {
  const res = await fn();
  if (!res.ok) { toast.error(res.error.message); return false; }
  toast.success(ok);
  return true;
}

/** "01:24:09" from a start time, ticking every second. */
function useElapsed(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return "00:00:00";
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

function WorkPicker({ work, projectId, taskId, onProject, onTask, idPrefix, fe }: {
  work: Work; projectId: string; taskId: string; onProject: (v: string) => void; onTask: (v: string) => void; idPrefix: string; fe?: (k: string) => string | undefined;
}) {
  if (work.length === 0) return null;
  const tasks = work.find((p) => p.id === projectId)?.tasks ?? [];
  return (
    <>
      <Field id={`${idPrefix}-project`} label="Project" error={fe?.("projectId")}>
        <Select value={projectId} onValueChange={(v) => { onProject(v); onTask(""); }} options={[{ value: "", label: "No project" }, ...work.map((p) => ({ value: p.id, label: p.name }))]} />
      </Field>
      <Field id={`${idPrefix}-task`} label="Task" error={fe?.("taskId")}>
        <Select value={taskId} onValueChange={onTask} disabled={!projectId || tasks.length === 0}
          options={[{ value: "", label: projectId ? (tasks.length ? "No specific task" : "No open tasks") : "Pick a project first" }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]} />
      </Field>
    </>
  );
}

export interface RunningTimer { id: string; startedAt: string; description: string | null; project: string | null; task: string | null; billable: boolean }

/** The big timer at the top of My time. */
export function TimerCard({ slug, running, work, locked }: { slug: string; running: RunningTimer | null; work: Work; locked: boolean }) {
  const elapsed = useElapsed(running?.startedAt ?? null);
  const [v, setV] = useState({ description: "", projectId: "", taskId: "", billable: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function start(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await startTimerAction(slug, v);
    setBusy(false);
    if (!res.ok) { setErr(res.error.message); return; }
    if (res.data.stopped) toast.success(`Saved ${formatMinutes(res.data.stopped.minutes)} from the previous timer`);
    setV((s) => ({ ...s, description: "" }));
  }
  return (
    <Card className={cn("motion-safe:animate-rise overflow-hidden", running && "border-primary/40")}>
      {running ? (
        <div className="flex flex-wrap items-center gap-5 p-5 sm:p-6">
          <span className="relative flex size-3 shrink-0" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" /><span className="relative inline-flex size-3 rounded-full bg-danger" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{running.description || "Working"}</p>
            <p className="truncate text-sm text-muted-foreground">{[running.project, running.task].filter(Boolean).join(" · ") || "No project"}{running.billable ? " · Billable" : ""}</p>
          </div>
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl" aria-live="off">{elapsed}</p>
          <div className="flex gap-2">
            <Button loading={busy} onClick={async () => { setBusy(true); const res = await stopTimerAction(slug); setBusy(false); if (!res.ok) toast.error(res.error.message); else toast.success(`Saved ${formatMinutes(res.data.minutes)}`); }}><Pause />Stop</Button>
            <ConfirmDialog trigger={<Button variant="ghost" aria-label="Discard timer" className="text-muted-foreground hover:text-danger"><X /></Button>} title="Discard this timer?"
              description="The time it has counted so far isn't saved." confirmLabel="Discard" onConfirm={() => act(() => discardTimerAction(slug), "Timer discarded")} />
          </div>
        </div>
      ) : (
        <form onSubmit={start} noValidate className="grid gap-4 p-5 sm:p-6">
          {err && <Alert tone="danger" title={err} />}
          <div className={cn("grid gap-4", work.length > 0 ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]" : "")}>
            <Field id="timer-desc" label="What are you working on?"><Input value={v.description} onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} maxLength={300} placeholder="Homepage design" /></Field>
            <WorkPicker work={work} projectId={v.projectId} taskId={v.taskId} idPrefix="timer" onProject={(p) => setV((s) => ({ ...s, projectId: p }))} onTask={(t) => setV((s) => ({ ...s, taskId: t }))} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 text-sm"><Checkbox checked={v.billable} onCheckedChange={(c) => setV((s) => ({ ...s, billable: c === true }))} />Billable to the client</label>
            <Button type="submit" size="lg" loading={busy} disabled={locked} title={locked ? "This week is submitted or approved" : undefined}><Play />Start timer</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/** Small "● 00:12:31" in the header while a timer runs. */
export function RunningPill({ href, startedAt, label }: { href: string; startedAt: string; label: string }) {
  const elapsed = useElapsed(startedAt);
  return (
    <Link href={href} title={`Timer running: ${label}`} className="hidden shrink-0 items-center gap-2 rounded-full border border-danger/30 bg-danger-subtle px-3 py-1 text-xs font-semibold text-danger sm:inline-flex">
      <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden /><span className="font-mono tabular-nums">{elapsed}</span>
    </Link>
  );
}

export interface EntryFormValue { id: string; workDate: string; minutes: number; projectId: string | null; taskId: string | null; description: string | null; billable: boolean }

export function EntryDialog({ slug, trigger, work, today, defaultDate, entry }: { slug: string; trigger: ReactNode; work: Work; today: string; defaultDate: string; entry?: EntryFormValue }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const init = () => ({
    workDate: entry?.workDate ?? defaultDate, duration: entry ? formatMinutes(entry.minutes) : "", projectId: entry?.projectId ?? "", taskId: entry?.taskId ?? "",
    description: entry?.description ?? "", billable: entry?.billable ?? false,
  });
  const [v, setV] = useState(init);
  const fe = (k: string) => fields[k]?.[0];
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setFields({}); setSaving(true);
    const res = entry ? await updateEntryAction(slug, entry.id, v) : await createEntryAction(slug, v);
    setSaving(false);
    if (!res.ok) { setError(res.error.message); setFields(res.error.fields ?? {}); return; }
    toast.success(entry ? "Time updated" : "Time added");
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(init()); setError(null); setFields({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{entry ? "Edit time" : "Add time"}</DialogTitle><DialogDescription>Forgot the timer? Type the time: 1:30, 1.5 or 90m all work.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {error && <Alert tone="danger" title={error} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="entry-date" label="Day" error={fe("workDate")}><Input type="date" value={v.workDate} max={today} onChange={(e) => setV((s) => ({ ...s, workDate: e.target.value }))} /></Field>
            <Field id="entry-duration" label="Time spent" error={fe("duration")}><Input autoFocus value={v.duration} onChange={(e) => setV((s) => ({ ...s, duration: e.target.value }))} placeholder="1:30" inputMode="decimal" /></Field>
          </div>
          <Field id="entry-desc" label="What did you do? (optional)" error={fe("description")}><Input value={v.description} onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} maxLength={300} /></Field>
          {work.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <WorkPicker work={work} projectId={v.projectId} taskId={v.taskId} idPrefix="entry" fe={fe} onProject={(p) => setV((s) => ({ ...s, projectId: p }))} onTask={(t) => setV((s) => ({ ...s, taskId: t }))} />
            </div>
          )}
          <label className="flex items-center gap-2.5 text-sm"><Checkbox checked={v.billable} onCheckedChange={(c) => setV((s) => ({ ...s, billable: c === true }))} />Billable to the client</label>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{entry ? "Save" : "Add time"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteEntryButton({ slug, id, label }: { slug: string; id: string; label: string }) {
  return (
    <ConfirmDialog trigger={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${label}`} className="text-muted-foreground hover:text-danger"><Trash2 /></Button>}
      title="Delete this time?" description={`${label} is removed from your week.`} confirmLabel="Delete" onConfirm={() => act(() => deleteEntryAction(slug, id), "Time deleted")} />
  );
}

export function WeekSubmit({ slug, weekStart, status, total, running }: { slug: string; weekStart: string; status: string; total: number; running: boolean }) {
  const [busy, setBusy] = useState(false);
  if (status === "submitted") {
    return <Button variant="secondary" loading={busy} onClick={async () => { setBusy(true); await act(() => withdrawWeekAction(slug, weekStart), "Timesheet taken back. You can edit this week again."); setBusy(false); }}><Undo2 />Withdraw</Button>;
  }
  if (status === "approved") return null;
  return (
    <ConfirmDialog trigger={<Button disabled={total === 0 || running} title={running ? "Stop the timer first" : total === 0 ? "No time this week yet" : undefined}><Send />{status === "rejected" ? "Send again" : "Submit week"}</Button>}
      title="Submit this week?" destructive={false} confirmLabel="Submit"
      description={`${formatMinutes(total)} hours go to your manager for approval. The week is locked until they review it (you can withdraw it before then).`}
      onConfirm={() => act(() => submitWeekAction(slug, weekStart), "Timesheet submitted")} />
  );
}

export function ReviewTimesheet({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex gap-1.5">
      <Button size="sm" loading={busy} onClick={async () => { setBusy(true); await act(() => reviewTimesheetAction(slug, id, { decision: "approve" }), `${name}'s week approved`); setBusy(false); }}><Check />Approve</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); setErr(null); }}>
        <DialogTrigger asChild><Button size="sm" variant="secondary"><X />Send back</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Send back {name}&apos;s week?</DialogTitle><DialogDescription>They can fix their time and submit it again.</DialogDescription></DialogHeader>
          <form noValidate className="grid gap-4" onSubmit={async (e) => {
            e.preventDefault(); setErr(null);
            const res = await reviewTimesheetAction(slug, id, { decision: "reject", note });
            if (!res.ok) { setErr(res.error.message); return; }
            toast.success("Sent back"); setOpen(false);
          }}>
            {err && <Alert tone="danger" title={err} />}
            <Field id={`rev-${id}`} label="What needs fixing? (optional)"><Input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Add the project to Tuesday's time" /></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="destructive">Send back</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BillHoursDialog({ slug, projectId, projectName, unbilled, currency, from, to, invoicesBase }: {
  slug: string; projectId: string; projectName: string; unbilled: number; currency: string; from: string; to: string; invoicesBase: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState("");
  const [groupBy, setGroupBy] = useState("person");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hours = unbilled / 60;
  const total = Number(rate) > 0 ? hours * Number(rate) : 0;
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setErr(null); }}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><Receipt />Invoice</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invoice {projectName}</DialogTitle><DialogDescription>{formatMinutes(unbilled)} billable hours from this period aren&apos;t invoiced yet. They go on a new draft invoice you can still check and edit.</DialogDescription></DialogHeader>
        <form noValidate className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault(); setErr(null); setBusy(true);
          const res = await billProjectHoursAction(slug, { projectId, rate, groupBy, from, to });
          setBusy(false);
          if (!res.ok) { setErr(res.error.message); return; }
          toast.success(`${res.data.number} drafted with ${res.data.hours} hours`);
          router.push(`${invoicesBase}/${res.data.id}`);
        }}>
          {err && <Alert tone="danger" title={err} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="bill-rate" label={`Hourly rate (${currency})`}><Input autoFocus inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" /></Field>
            <Field id="bill-group" label="One line per"><Select value={groupBy} onValueChange={setGroupBy} options={[{ value: "person", label: "Person" }, { value: "task", label: "Task" }]} /></Field>
          </div>
          <p className="text-sm text-muted-foreground">{hours.toFixed(2)} h × {rate || "0"} = <span className="font-semibold text-foreground">{new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(total)}</span> before tax</p>
          <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={busy}><Plus />Create draft invoice</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
