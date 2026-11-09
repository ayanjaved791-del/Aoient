"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, FolderKanban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PROJECT_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "./labels";
import {
  createMilestoneAction, createProjectAction, createProjectFromDealAction, createTaskAction, deleteTaskAction,
  setProjectArchivedAction, updateMilestoneAction, updateProjectAction, updateTaskAction,
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
  return { open, setOpen, onOpenChange: (o: boolean) => { setOpen(o); setError(null); setFields({}); }, error, saving, run, fe: (k: string) => fields[k]?.[0] };
}

/* ─────────────────────────────── projects ─────────────────────────────── */

export interface ProjectFormValue {
  id: string; name: string; description: string | null; status: string; companyId: string | null; dealId: string | null;
  ownerId: string | null; startDate: string | null; dueDate: string | null; memberIds: string[];
}

export function ProjectDialog({ slug, trigger, people, companies, project, me }: {
  slug: string; trigger: ReactNode; people: Opt[]; companies: Opt[] | null; project?: ProjectFormValue; me: string;
}) {
  const f = useDialogForm();
  const router = useRouter();
  const [v, setV] = useState({
    name: project?.name ?? "", description: project?.description ?? "", status: project?.status ?? "active", companyId: project?.companyId ?? "",
    ownerMemberId: project?.ownerId ?? me, startDate: project?.startDate ?? "", dueDate: project?.dueDate ?? "",
  });
  const [team, setTeam] = useState<Set<string>>(new Set(project?.memberIds ?? [me]));
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  const toggle = (id: string) => setTeam((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  function submit(e: FormEvent) {
    e.preventDefault();
    const input = { ...v, dealId: project?.dealId ?? null, memberIds: [...team] };
    f.run(() => (project ? updateProjectAction(slug, project.id, input) : createProjectAction(slug, input)) as Promise<Result<{ id: string } | undefined>>, (d) => {
      toast.success(project ? "Project updated" : `${v.name} created`);
      if (!project && d && "id" in d) router.push(`/${slug}/projects/${d.id}`);
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle><DialogDescription>A piece of work with a team, tasks and a finish line.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="pr-name" label="Name" error={f.fe("name")}><Input autoFocus value={v.name} onChange={(e) => set("name")(e.target.value)} maxLength={100} placeholder="e.g. Website relaunch" /></Field>
          <Field id="pr-desc" label="Description (optional)" error={f.fe("description")}><Textarea rows={2} value={v.description} onChange={(e) => set("description")(e.target.value)} maxLength={2000} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pr-status" label="Status"><Select value={v.status} onValueChange={set("status")} options={Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label }))} /></Field>
            <Field id="pr-owner" label="Project lead" error={f.fe("owner")}><Select value={v.ownerMemberId} onValueChange={set("ownerMemberId")} options={people.map((p) => ({ value: p.id, label: p.name }))} /></Field>
            <Field id="pr-start" label="Start (optional)" error={f.fe("startDate")}><Input type="date" value={v.startDate} onChange={(e) => set("startDate")(e.target.value)} /></Field>
            <Field id="pr-due" label="Due (optional)" error={f.fe("dueDate")}><Input type="date" value={v.dueDate} onChange={(e) => set("dueDate")(e.target.value)} /></Field>
          </div>
          {companies && (
            <Field id="pr-client" label="Client (optional)" error={f.fe("company")}><Select value={v.companyId} onValueChange={set("companyId")} options={[{ value: "", label: "No client" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
          )}
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Team <span className="font-normal text-muted-foreground">({team.size})</span></legend>
            {f.fe("members") && <p className="text-xs text-danger">{f.fe("members")}</p>}
            <div className="scroll-thin grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-border p-2">
              {people.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted">
                  <Checkbox checked={team.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <Avatar name={p.name} size="sm" /><span className="truncate">{p.name}{p.id === me && <span className="text-muted-foreground"> (you)</span>}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Team members see this project and can be given its tasks. The project lead is always on the team.</p>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{project ? "Save" : "Create project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveProjectButton({ slug, id, name, archived }: { slug: string; id: string; name: string; archived: boolean }) {
  const router = useRouter();
  if (archived) {
    return <Button variant="secondary" onClick={async () => { const r = await setProjectArchivedAction(slug, id, false); if (r.ok) toast.success(`${name} restored`); else toast.error(r.error.message); }}><ArchiveRestore />Restore</Button>;
  }
  return (
    <ConfirmDialog trigger={<Button variant="ghost" className="text-muted-foreground hover:text-danger"><Archive />Archive</Button>}
      title={`Archive ${name}?`} description="It's hidden from project lists and My tasks. Nothing is deleted, and you can restore it." confirmLabel="Archive"
      onConfirm={async () => { const r = await setProjectArchivedAction(slug, id, true); if (!r.ok) { toast.error(r.error.message); return false; } toast.success(`${name} archived`); router.push(`/${slug}/projects`); }} />
  );
}

/** On a won deal: make (or open) its project. */
export function StartProjectButton({ slug, dealId, existingId }: { slug: string; dealId: string; existingId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (existingId) return <Button variant="secondary" onClick={() => router.push(`/${slug}/projects/${existingId}`)}><FolderKanban />Open project</Button>;
  return (
    <Button loading={busy} onClick={async () => {
      setBusy(true);
      const r = await createProjectFromDealAction(slug, dealId);
      setBusy(false);
      if (!r.ok) return toast.error(r.error.message);
      toast.success("Project created from this deal");
      router.push(`/${slug}/projects/${r.data.id}`);
    }}><FolderKanban />Start project</Button>
  );
}

/* ─────────────────────────────── milestones ─────────────────────────────── */

export function MilestoneDialog({ slug, projectId, trigger, milestone }: { slug: string; projectId: string; trigger: ReactNode; milestone?: { id: string; name: string; dueDate: string | null } }) {
  const f = useDialogForm();
  const [name, setName] = useState(milestone?.name ?? "");
  const [due, setDue] = useState(milestone?.dueDate ?? "");
  function submit(e: FormEvent) {
    e.preventDefault();
    const input = { name, dueDate: due };
    f.run(() => (milestone ? updateMilestoneAction(slug, milestone.id, input) : createMilestoneAction(slug, projectId, input)) as Promise<Result>, () => {
      toast.success(milestone ? "Milestone updated" : `${name} added`);
      if (!milestone) { setName(""); setDue(""); }
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{milestone ? "Edit milestone" : "New milestone"}</DialogTitle><DialogDescription>A checkpoint, like &ldquo;Design signed off&rdquo;.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="ms-name" label="Name" error={f.fe("name")}><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
          <Field id="ms-due" label="Due (optional)" error={f.fe("dueDate")}><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{milestone ? "Save" : "Add milestone"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────── tasks ─────────────────────────────── */

export interface TaskFormValue {
  id: string; title: string; description: string | null; status: string; priority: string; assigneeId: string | null; milestoneId: string | null; dueDate: string | null;
}

/** canAssignOthers: without it, a task can only be left unassigned or given to yourself. */
export function TaskDialog({ slug, projectId, trigger, team, milestones, task, me, canAssignOthers, defaultStatus }: {
  slug: string; projectId: string; trigger: ReactNode; team: Opt[]; milestones: Opt[]; task?: TaskFormValue; me: string | null; canAssignOthers: boolean; defaultStatus?: string;
}) {
  const f = useDialogForm();
  const [v, setV] = useState({
    title: task?.title ?? "", description: task?.description ?? "", status: task?.status ?? defaultStatus ?? "todo", priority: task?.priority ?? "medium",
    assigneeMemberId: task?.assigneeId ?? "", milestoneId: task?.milestoneId ?? "", dueDate: task?.dueDate ?? "",
  });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  const assignable = canAssignOthers ? team : team.filter((p) => p.id === me || p.id === task?.assigneeId);
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => (task ? updateTaskAction(slug, task.id, v) : createTaskAction(slug, projectId, v)) as Promise<Result>, () => {
      toast.success(task ? "Task updated" : "Task added");
      if (!task) setV((s) => ({ ...s, title: "", description: "", dueDate: "" }));
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle><DialogDescription>One thing that needs doing.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="tk-title" label="Title" error={f.fe("title")}><Input autoFocus value={v.title} onChange={(e) => set("title")(e.target.value)} maxLength={200} /></Field>
          <Field id="tk-desc" label="Details (optional)" error={f.fe("description")}><Textarea rows={3} value={v.description} onChange={(e) => set("description")(e.target.value)} maxLength={4000} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="tk-status" label="Status"><Select value={v.status} onValueChange={set("status")} options={Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label }))} /></Field>
            <Field id="tk-prio" label="Priority"><Select value={v.priority} onValueChange={set("priority")} options={Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} /></Field>
            <Field id="tk-assignee" label="Assignee" error={f.fe("assignee")}><Select value={v.assigneeMemberId} onValueChange={set("assigneeMemberId")} options={[{ value: "", label: "Unassigned" }, ...assignable.map((p) => ({ value: p.id, label: p.id === me ? `${p.name} (you)` : p.name }))]} /></Field>
            <Field id="tk-due" label="Due (optional)" error={f.fe("dueDate")}><Input type="date" value={v.dueDate} onChange={(e) => set("dueDate")(e.target.value)} /></Field>
          </div>
          {milestones.length > 0 && (
            <Field id="tk-ms" label="Milestone (optional)" error={f.fe("milestone")}><Select value={v.milestoneId} onValueChange={set("milestoneId")} options={[{ value: "", label: "None" }, ...milestones.map((m) => ({ value: m.id, label: m.name }))]} /></Field>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{task ? "Save" : "Add task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTaskButton({ slug, id, title, projectId }: { slug: string; id: string; title: string; projectId: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog trigger={<Button variant="ghost" className="text-muted-foreground hover:text-danger"><Trash2 />Delete task</Button>}
      title={`Delete "${title}"?`} description="The task and its comments are removed for everyone." confirmLabel="Delete"
      onConfirm={async () => { const r = await deleteTaskAction(slug, id); if (!r.ok) { toast.error(r.error.message); return false; } toast.success("Task deleted"); router.push(`/${slug}/projects/${projectId}`); }} />
  );
}
