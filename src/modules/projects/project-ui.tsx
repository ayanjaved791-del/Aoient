"use client";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Check, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MilestoneDialog } from "./forms";
import { fullDate } from "./labels";
import { addCommentAction, deleteCommentAction, deleteMilestoneAction, setMilestoneDoneAction } from "./actions";

export interface MilestoneView { id: string; name: string; dueDate: string | null; done: boolean; total: number; finished: number; overdue: boolean }

/** Milestones with a tick box, progress from their tasks, edit and delete for project managers. */
export function MilestoneList({ slug, projectId, milestones, canEdit }: { slug: string; projectId: string; milestones: MilestoneView[]; canEdit: boolean }) {
  const [list, setDone] = useOptimistic(milestones, (s, m: { id: string; done: boolean }) => s.map((x) => (x.id === m.id ? { ...x, done: m.done } : x)));
  const [, start] = useTransition();
  if (list.length === 0) return <p className="text-sm text-muted-foreground">No milestones yet.</p>;
  return (
    <ol className="relative grid gap-3 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-border">
      {list.map((m) => {
        const pct = m.total ? Math.round((m.finished / m.total) * 100) : 0;
        return (
          <li key={m.id} className="group relative flex items-start gap-3">
            <button type="button" disabled={!canEdit} aria-label={m.done ? `Mark ${m.name} as not done` : `Mark ${m.name} as done`} aria-pressed={m.done}
              onClick={() => start(async () => { setDone({ id: m.id, done: !m.done }); const r = await setMilestoneDoneAction(slug, m.id, !m.done); if (!r.ok) toast.error(r.error.message); })}
              className={cn("relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                m.done ? "border-success bg-success text-white" : "border-input bg-surface", canEdit && !m.done && "hover:border-primary")}>
              {m.done && <Check className="size-3.5" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <p className={cn("min-w-0 flex-1 text-sm font-medium", m.done && "text-muted-foreground line-through")}>{m.name}</p>
                {canEdit && (
                  <span className="flex shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <MilestoneDialog slug={slug} projectId={projectId} milestone={{ id: m.id, name: m.name, dueDate: m.dueDate }} trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${m.name}`}><Pencil /></Button>} />
                    <ConfirmDialog trigger={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${m.name}`} className="hover:text-danger"><Trash2 /></Button>}
                      title={`Delete ${m.name}?`} description="Tasks in it stay in the project, without a milestone." confirmLabel="Delete"
                      onConfirm={async () => { const r = await deleteMilestoneAction(slug, m.id); if (!r.ok) { toast.error(r.error.message); return false; } }} />
                  </span>
                )}
              </div>
              <p className={cn("text-xs", m.overdue && !m.done ? "font-medium text-danger" : "text-muted-foreground")}>
                {m.dueDate ? `Due ${fullDate(m.dueDate)}` : "No due date"} · {m.total ? `${m.finished}/${m.total} tasks` : "No tasks"}
              </p>
              {m.total > 0 && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                  <div className="h-full origin-left rounded-full bg-primary motion-safe:animate-grow-x" style={{ width: `${Math.max(4, pct)}%` }} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface CommentView { id: string; body: string; author: string; mine: boolean; at: string; ago: string }

export function TaskComments({ slug, taskId, comments }: { slug: string; taskId: string; comments: CommentView[] }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    const r = await addCommentAction(slug, taskId, { body });
    setSaving(false);
    if (!r.ok) return toast.error(r.error.fields?.body?.[0] ?? r.error.message);
    setBody("");
  }
  return (
    <div className="grid gap-4">
      {comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet. Ask a question or share an update.</p> : (
        <ol className="grid gap-3">
          {comments.map((c, i) => (
            <li key={c.id} className="motion-safe:animate-rise flex gap-3" style={{ animationDelay: `${i * 30}ms` }}>
              <Avatar name={c.author} size="sm" />
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
                <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.author}</span><time dateTime={c.at}>{c.ago}</time>
                  {c.mine && <button type="button" aria-label="Delete comment" className="ml-auto rounded p-0.5 hover:text-danger" onClick={async () => { const r = await deleteCommentAction(slug, c.id); if (!r.ok) toast.error(r.error.message); }}><Trash2 className="size-3.5" /></button>}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={submit} className="grid gap-2">
        <Textarea aria-label="New comment" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder="Write a comment…"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Ctrl + Enter to send</p>
          <Button type="submit" size="sm" loading={saving} disabled={!body.trim()}><Send />Comment</Button>
        </div>
      </form>
    </div>
  );
}
