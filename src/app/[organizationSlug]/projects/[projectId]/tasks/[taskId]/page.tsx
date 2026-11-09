import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays, Flag, FolderKanban, Milestone, Pencil, UserRound } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getProject } from "@/server/projects/projects";
import { getTask } from "@/server/projects/tasks";
import { NotFoundError } from "@/lib/errors";
import { timeAgo } from "@/lib/activity";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteTaskButton, TaskDialog } from "@/modules/projects/forms";
import { TaskComments } from "@/modules/projects/project-ui";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_TONE, TASK_STATUS_LABELS, fullDate } from "@/modules/projects/labels";

export const metadata: Metadata = { title: "Task" };

async function TaskView({ params }: PageProps<"/[organizationSlug]/projects/[projectId]/tasks/[taskId]">) {
  const { organizationSlug, projectId, taskId } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "projects.task.read")) return <PermissionDenied what="tasks" />;
  const t = await getTask(ctx, taskId).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  if (t.projectId !== projectId) notFound();
  const p = await getProject(ctx, t.projectId);
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.organization.timezone }).format(now);
  const overdue = t.status !== "done" && !!t.dueDate && t.dueDate < today;
  const back = `/${ctx.organization.slug}/projects/${p.id}`;
  const facts = [
    { icon: FolderKanban, label: "Project", value: <Link href={back} className="font-medium hover:underline">{p.name}</Link> },
    { icon: UserRound, label: "Assignee", value: t.assignee?.name ?? "Unassigned" },
    { icon: CalendarDays, label: "Due", value: t.dueDate ? <span className={overdue ? "font-medium text-danger" : ""}>{fullDate(t.dueDate)}{overdue ? " · overdue" : ""}</span> : "No due date" },
    { icon: Flag, label: "Priority", value: <Badge tone={TASK_PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABELS[t.priority]}</Badge> },
    { icon: Milestone, label: "Milestone", value: t.milestone?.name ?? "None" },
  ];
  const me = p.members.some((m) => m.id === ctx.memberId) ? ctx.memberId : null;

  return (
    <div className="grid min-w-0 gap-6">
      <Link href={back} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{p.name}</Link>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-6">
          <Card className="motion-safe:animate-rise p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <Badge tone={t.status === "done" ? "success" : t.status === "in_progress" ? "primary" : t.status === "review" ? "warning" : "neutral"}>{TASK_STATUS_LABELS[t.status]}</Badge>
                <h1 className={`mt-2 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>{t.title}</h1>
                <p className="mt-1 text-xs text-muted-foreground">Added {timeAgo(t.createdAt, now)}{t.createdBy ? ` by ${t.createdBy}` : ""}{t.completedAt ? ` · done ${timeAgo(t.completedAt, now)}` : ""}</p>
              </div>
              {t.canEdit && !p.archived && (
                <TaskDialog slug={ctx.organization.slug} projectId={p.id} team={p.members} milestones={p.milestones.map((m) => ({ id: m.id, name: m.name }))} me={me}
                  canAssignOthers={can(ctx, "projects.task.assign")} trigger={<Button variant="secondary"><Pencil />Edit</Button>}
                  task={{ id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, assigneeId: t.assignee?.id ?? null, milestoneId: t.milestone?.id ?? null, dueDate: t.dueDate }} />
              )}
            </div>
            <div className="mt-5 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{t.description ?? <span className="text-muted-foreground">No details.</span>}</div>
          </Card>
          <Card className="motion-safe:animate-rise p-5 [animation-delay:80ms] sm:p-6">
            <h2 className="mb-4 text-base font-semibold">Comments ({t.thread.length})</h2>
            <TaskComments slug={ctx.organization.slug} taskId={t.id}
              comments={t.thread.map((c) => ({ id: c.id, body: c.body, author: c.author, mine: c.mine, at: c.createdAt.toISOString(), ago: timeAgo(c.createdAt, now) }))} />
          </Card>
        </div>
        <aside className="grid content-start gap-4">
          <Card className="motion-safe:animate-rise p-5 [animation-delay:120ms]">
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="mt-4 grid gap-3">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 text-sm">
                  <f.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <dt className="w-20 shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 truncate">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {t.canEdit && !p.archived && <div><DeleteTaskButton slug={ctx.organization.slug} id={t.id} title={t.title} projectId={p.id} /></div>}
        </aside>
      </div>
    </div>
  );
}

export default function TaskPage(props: PageProps<"/[organizationSlug]/projects/[projectId]/tasks/[taskId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-5 w-32" /><Skeleton className="h-60" /><Skeleton className="h-60" /></div>}><TaskView {...props} /></Suspense>;
}
