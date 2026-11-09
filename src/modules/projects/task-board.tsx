"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import { CalendarDays, CheckCircle2, MessageSquare, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { dayLabel, TASK_PRIORITY_LABELS, TASK_PRIORITY_TONE, TASK_STATUS_LABELS } from "./labels";
import { moveTaskAction } from "./actions";
import { TaskDialog } from "./forms";

export interface BoardTask {
  id: string; title: string; status: string; priority: string; position: number; dueDate: string | null; assignee: string | null;
  milestone: string | null; comments: number; canEdit: boolean; overdue: boolean;
}
const COLUMNS = ["todo", "in_progress", "review", "done"] as const;

/**
 * Tasks by status. Drag a card to another column or between cards; the menu
 * does the same from the keyboard or a phone. Only cards you may change move.
 */
export interface BoardCreate { projectId: string; team: { id: string; name: string }[]; milestones: { id: string; name: string }[]; me: string | null; canAssignOthers: boolean }

export function TaskBoard({ slug, base, tasks, create }: { slug: string; base: string; tasks: BoardTask[]; create?: BoardCreate }) {
  const [list, apply] = useOptimistic(tasks, (state, m: { id: string; status: string; position: number }) =>
    state.map((t) => (t.id === m.id ? { ...t, status: m.status, position: m.position } : t)));
  const [, start] = useTransition();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: string; before: string | null } | null>(null);

  const column = (status: string) => list.filter((t) => t.status === status).sort((a, b) => a.position - b.position);

  function move(task: BoardTask, status: string, beforeCardId: string | null) {
    const cards = column(status).filter((c) => c.id !== task.id);
    const idx = beforeCardId ? cards.findIndex((c) => c.id === beforeCardId) : cards.length;
    const prev = idx > 0 ? cards[idx - 1] : null, next = idx >= 0 && idx < cards.length ? cards[idx] : null;
    if (task.status === status && beforeCardId === task.id) return;
    const position = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + 1024 : next ? next.position - 1024 : 1024;
    start(async () => {
      apply({ id: task.id, status, position });
      const res = await moveTaskAction(slug, task.id, { status, beforeId: prev?.id ?? null, afterId: next?.id ?? null });
      if (!res.ok) toast.error(res.error.message);
      else if (status === "done" && task.status !== "done") toast.success(`Done: ${task.title}`);
    });
  }

  const onDrop = (status: string) => (e: DragEvent) => {
    e.preventDefault();
    const t = list.find((x) => x.id === e.dataTransfer.getData("text/task-id"));
    const before = over?.col === status ? over.before : null;
    setDrag(null); setOver(null);
    if (t) move(t, status, before);
  };

  return (
    <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <ol className="grid min-w-[1000px] grid-cols-4 gap-3" aria-label="Task board">
        {COLUMNS.map((status, ci) => {
          const cards = column(status);
          const isOver = over?.col === status && drag !== null;
          return (
            <li key={status} className="motion-safe:animate-rise" style={{ animationDelay: `${ci * 50}ms` }}>
              <section aria-label={`${TASK_STATUS_LABELS[status]}, ${cards.length}`}
                onDragOver={(e) => { e.preventDefault(); if (over?.col !== status) setOver({ col: status, before: null }); }}
                onDrop={onDrop(status)}
                className={cn("flex h-full min-h-80 flex-col rounded-xl border bg-surface-muted/50 p-2 transition-colors", isOver ? "border-primary bg-surface-muted" : "border-border")}>
                <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                  {status === "done" ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <span className={cn("size-2 rounded-full", status === "todo" ? "bg-muted-foreground" : status === "in_progress" ? "bg-primary" : "bg-warning")} aria-hidden />}
                  <h2 className="flex-1 text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground ring-1 ring-border">{cards.length}</span>
                </header>
                <ul className="grid flex-1 content-start gap-2">
                  {cards.map((t) => (
                    <li key={t.id} draggable={t.canEdit}
                      onDragStart={(e) => { e.dataTransfer.setData("text/task-id", t.id); e.dataTransfer.effectAllowed = "move"; setDrag(t.id); }}
                      onDragEnd={() => { setDrag(null); setOver(null); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const below = e.clientY > r.top + r.height / 2;
                        const i = cards.findIndex((c) => c.id === t.id); setOver({ col: status, before: below ? (cards[i + 1]?.id ?? null) : t.id }); }}
                      className={cn("group relative rounded-lg border bg-surface p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
                        isOver && over?.before === t.id ? "border-t-2 border-t-primary" : "border-border",
                        t.canEdit && "cursor-grab active:cursor-grabbing", drag === t.id && "opacity-40", status === "done" && "opacity-75")}>
                      <div className="flex items-start gap-1.5">
                        <Link href={`${base}/tasks/${t.id}`} className={cn("min-w-0 flex-1 text-sm font-medium leading-snug hover:underline after:absolute after:inset-0", status === "done" && "line-through decoration-muted-foreground/60")}>{t.title}</Link>
                        {t.canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="relative z-10 -mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 hover:bg-surface-muted hover:text-foreground group-hover:opacity-100" aria-label={`Move ${t.title}`}>
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Move to</DropdownMenuLabel>
                              {COLUMNS.map((s) => <DropdownMenuItem key={s} disabled={s === t.status} onSelect={() => move(t, s, null)}>{TASK_STATUS_LABELS[s]}</DropdownMenuItem>)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      {t.milestone && <p className="mt-1 truncate text-xs text-muted-foreground">{t.milestone}</p>}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {t.priority !== "medium" && <Badge tone={TASK_PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>}
                        {t.dueDate && <span className={cn("inline-flex items-center gap-1 text-[11px]", t.overdue ? "font-medium text-danger" : "text-muted-foreground")}><CalendarDays className="size-3" aria-hidden />{dayLabel(t.dueDate)}</span>}
                        {t.comments > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><MessageSquare className="size-3" aria-hidden />{t.comments}</span>}
                        {t.assignee ? <Avatar name={t.assignee} size="sm" className="ml-auto size-6 text-[10px]" /> : <span className="ml-auto text-[11px] text-muted-foreground">Unassigned</span>}
                      </div>
                    </li>
                  ))}
                  {cards.length === 0 && <li className={cn("rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground", isOver ? "border-primary" : "border-border")}>Drop a task here</li>}
                </ul>
                {create && status !== "done" && (
                  <div className="pt-2">
                    <TaskDialog slug={slug} projectId={create.projectId} team={create.team} milestones={create.milestones} me={create.me} canAssignOthers={create.canAssignOthers} defaultStatus={status}
                      trigger={<button type="button" className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"><Plus className="size-4" />Add task</button>} />
                  </div>
                )}
              </section>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
