import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, CircleCheck, ListTodo } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listMyTasks, type TaskRow } from "@/server/projects/tasks";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/modules/dashboard/people-widgets";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_TONE, TASK_STATUS_LABELS, dayLabel } from "@/modules/projects/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My tasks" };

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

async function MyTasks({ params }: PageProps<"/[organizationSlug]/projects/my-tasks">) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "projects.task.read")) return <PermissionDenied what="tasks" />;
  const tasks = await listMyTasks(ctx);
  const base = `/${ctx.organization.slug}/projects`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.organization.timezone }).format(new Date());
  const week = addDays(today, 7);
  const open = tasks.filter((t) => t.status !== "done");
  const groups: { key: string; title: string; tone?: string; items: TaskRow[] }[] = [
    { key: "overdue", title: "Overdue", tone: "text-danger", items: open.filter((t) => t.dueDate && t.dueDate < today) },
    { key: "today", title: "Today", items: open.filter((t) => t.dueDate === today) },
    { key: "week", title: "Next 7 days", items: open.filter((t) => t.dueDate && t.dueDate > today && t.dueDate <= week) },
    { key: "later", title: "Later", items: open.filter((t) => t.dueDate && t.dueDate > week) },
    { key: "none", title: "No due date", items: open.filter((t) => !t.dueDate) },
    { key: "done", title: "Done in the last 7 days", items: tasks.filter((t) => t.status === "done") },
  ];
  const stats = [
    { label: "Open", value: open.length }, { label: "Overdue", value: groups[0].items.length },
    { label: "Due this week", value: groups[1].items.length + groups[2].items.length }, { label: "Done this week", value: groups[5].items.length },
  ];

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="My tasks" description="Everything assigned to you, across your projects." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Card key={s.label} className="motion-safe:animate-rise p-4" style={{ animationDelay: `${i * 50}ms` }}>
            <p className={cn("text-2xl font-semibold", s.label === "Overdue" && s.value > 0 && "text-danger")}><CountUp value={s.value} delay={150 + i * 60} /></p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>
      {tasks.length === 0 ? (
        <Card><EmptyState icon={ListTodo} title="Nothing assigned to you" description="Tasks your team gives you show up here, grouped by when they're due." /></Card>
      ) : groups.filter((g) => g.items.length > 0).map((g, gi) => (
        <section key={g.key} className="motion-safe:animate-rise grid gap-2" style={{ animationDelay: `${120 + gi * 60}ms` }}>
          <h2 className={cn("text-sm font-semibold", g.tone)}>{g.title} <span className="font-normal text-muted-foreground">· {g.items.length}</span></h2>
          <Card className="divide-y divide-border overflow-hidden">
            {g.items.map((t) => (
              <Link key={t.id} href={`${base}/${t.projectId}/tasks/${t.id}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/50">
                {t.status === "done" ? <CircleCheck className="size-5 shrink-0 text-success" aria-hidden /> : <span className="size-5 shrink-0 rounded-full border-2 border-input" aria-hidden />}
                <span className="grid min-w-0 flex-1">
                  <span className={cn("truncate text-sm font-medium group-hover:underline", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{t.projectName}{t.milestone ? ` · ${t.milestone.name}` : ""} · {TASK_STATUS_LABELS[t.status]}</span>
                </span>
                {t.priority !== "medium" && <Badge tone={TASK_PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>}
                {t.dueDate && <span className={cn("hidden items-center gap-1 text-xs sm:inline-flex", g.key === "overdue" ? "font-medium text-danger" : "text-muted-foreground")}><CalendarDays className="size-3.5" aria-hidden />{dayLabel(t.dueDate)}</span>}
              </Link>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}

export default function MyTasksPage(props: PageProps<"/[organizationSlug]/projects/my-tasks">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-20" /><Skeleton className="h-72" /></div>}><MyTasks {...props} /></Suspense>;
}
