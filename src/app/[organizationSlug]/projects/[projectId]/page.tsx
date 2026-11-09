import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Building2, CalendarDays, Handshake, Pencil, Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getProject, listProjectPeople } from "@/server/projects/projects";
import { listTasks } from "@/server/projects/tasks";
import { listCompanies } from "@/server/crm/contacts";
import { NotFoundError } from "@/lib/errors";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/modules/dashboard/people-widgets";
import { ArchiveProjectButton, MilestoneDialog, ProjectDialog, TaskDialog } from "@/modules/projects/forms";
import { MilestoneList } from "@/modules/projects/project-ui";
import { TaskBoard } from "@/modules/projects/task-board";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE, fullDate } from "@/modules/projects/labels";

export const metadata: Metadata = { title: "Project" };

async function ProjectView({ params }: PageProps<"/[organizationSlug]/projects/[projectId]">) {
  const { organizationSlug, projectId } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "projects.project.read")) return <PermissionDenied what="projects" />;
  const p = await getProject(ctx, projectId).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const base = `/${ctx.organization.slug}/projects/${p.id}`;
  const canEdit = can(ctx, "projects.project.update");
  const seesTasks = can(ctx, "projects.task.read");
  const canAddTask = can(ctx, "projects.task.create") && !p.archived;
  const [tasks, people, companies] = await Promise.all([
    seesTasks ? listTasks(ctx, p.id) : [],
    canEdit ? listProjectPeople(ctx) : [],
    canEdit && can(ctx, "crm.contact.read") ? listCompanies(ctx) : null,
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.organization.timezone }).format(new Date());
  const pct = p.tasks.total ? Math.round((p.tasks.done / p.tasks.total) * 100) : 0;
  const milestoneOpts = p.milestones.map((m) => ({ id: m.id, name: m.name }));
  const me = p.members.some((m) => m.id === ctx.memberId) ? ctx.memberId : null;
  const counts = { todo: 0, in_progress: 0, review: 0, done: 0 } as Record<string, number>;
  for (const t of tasks) counts[t.status]++;

  return (
    <div className="grid min-w-0 gap-6">
      <Link href={`/${ctx.organization.slug}/projects`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Projects</Link>

      <Card className="motion-safe:animate-rise overflow-hidden">
        <div className="relative bg-navy px-6 py-6 text-white dark:bg-[#161616]">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.1)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_left,black,transparent_80%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={PROJECT_STATUS_TONE[p.status]}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
                {p.archived && <Badge>Archived</Badge>}
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{p.name}</h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
                {p.company && (can(ctx, "crm.contact.read")
                  ? <Link href={`/${ctx.organization.slug}/crm/companies/${p.company.id}`} className="inline-flex items-center gap-1.5 hover:text-white hover:underline"><Building2 className="size-4" />{p.company.name}</Link>
                  : <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" />{p.company.name}</span>)}
                {p.deal && <Link href={`/${ctx.organization.slug}/crm/deals/${p.deal.id}`} className="inline-flex items-center gap-1.5 hover:text-white hover:underline"><Handshake className="size-4" />From deal: {p.deal.title}</Link>}
                {(p.startDate || p.dueDate) && <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{p.startDate ? fullDate(p.startDate) : "…"} → {p.dueDate ? fullDate(p.dueDate) : "no due date"}</span>}
              </div>
              {p.description && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-white/75">{p.description}</p>}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-3xl font-semibold tabular-nums"><CountUp value={pct} delay={200} />%</p>
                <p className="text-xs text-white/60">{p.tasks.done} of {p.tasks.total} tasks done</p>
              </div>
              {canEdit && (
                <ProjectDialog slug={ctx.organization.slug} me={ctx.memberId} people={people} companies={companies ? companies.map((c) => ({ id: c.id, name: c.name })) : null}
                  trigger={<Button variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Pencil />Edit</Button>}
                  project={{ id: p.id, name: p.name, description: p.description, status: p.status, companyId: p.company?.id ?? null, dealId: p.deal?.id ?? null,
                    ownerId: p.owner?.id ?? null, startDate: p.startDate, dueDate: p.dueDate, memberIds: p.members.map((m) => m.id) }} />
              )}
            </div>
          </div>
          <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
            {pct > 0 && <div className="h-full origin-left rounded-full bg-white motion-safe:animate-grow-x [animation-delay:250ms]" style={{ width: `${pct}%` }} />}
          </div>
        </div>
        <dl className="grid grid-cols-2 divide-border border-t border-border sm:grid-cols-4 sm:divide-x">
          {[["To do", counts.todo], ["In progress", counts.in_progress], ["Review", counts.review], ["Overdue", p.tasks.overdue]].map(([l, n], i) => (
            <div key={l} className="px-5 py-3">
              <dt className="text-xs text-muted-foreground">{l}</dt>
              <dd className={l === "Overdue" && Number(n) > 0 ? "text-lg font-semibold text-danger" : "text-lg font-semibold"}><CountUp value={Number(n)} delay={150 + i * 60} /></dd>
            </div>
          ))}
        </dl>
      </Card>

      {seesTasks && (
        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Tasks</h2>
            {canAddTask && (
              <TaskDialog slug={ctx.organization.slug} projectId={p.id} team={p.members} milestones={milestoneOpts} me={me} canAssignOthers={can(ctx, "projects.task.assign")}
                trigger={<Button size="sm"><Plus />New task</Button>} />
            )}
          </div>
          <TaskBoard slug={ctx.organization.slug} base={base}
            create={canAddTask ? { projectId: p.id, team: p.members, milestones: milestoneOpts, me, canAssignOthers: can(ctx, "projects.task.assign") } : undefined}
            tasks={tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, position: t.position, dueDate: t.dueDate,
              assignee: t.assignee?.name ?? null, milestone: t.milestone?.name ?? null, comments: t.comments, canEdit: t.canEdit && !p.archived,
              overdue: t.status !== "done" && !!t.dueDate && t.dueDate < today }))} />
        </section>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="motion-safe:animate-rise p-5 [animation-delay:120ms] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Milestones</h2>
            {canEdit && !p.archived && <MilestoneDialog slug={ctx.organization.slug} projectId={p.id} trigger={<Button variant="secondary" size="sm"><Plus />Milestone</Button>} />}
          </div>
          <div className="mt-4">
            <MilestoneList slug={ctx.organization.slug} projectId={p.id} canEdit={canEdit && !p.archived}
              milestones={p.milestones.map((m) => ({ id: m.id, name: m.name, dueDate: m.dueDate, done: Boolean(m.completedAt), total: m.total, finished: m.done, overdue: !!m.dueDate && m.dueDate < today }))} />
          </div>
        </Card>
        <aside className="grid content-start gap-4">
          <Card className="motion-safe:animate-rise p-5 [animation-delay:160ms]">
            <h2 className="text-sm font-semibold">Team ({p.members.length})</h2>
            <ul className="mt-3 grid gap-2.5">
              {p.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <Avatar name={m.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{m.name}{m.id === ctx.memberId && <span className="text-muted-foreground"> (you)</span>}</span>
                  {p.owner?.id === m.id && <Badge>Lead</Badge>}
                </li>
              ))}
            </ul>
          </Card>
          {can(ctx, "projects.project.archive") && <div><ArchiveProjectButton slug={ctx.organization.slug} id={p.id} name={p.name} archived={p.archived} /></div>}
        </aside>
      </div>
    </div>
  );
}

export default function ProjectPage(props: PageProps<"/[organizationSlug]/projects/[projectId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-5 w-24" /><Skeleton className="h-56" /><Skeleton className="h-96" /></div>}><ProjectView {...props} /></Suspense>;
}
