import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, CalendarDays, FolderKanban, Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listProjectPeople, listProjects, type ProjectStatus } from "@/server/projects/projects";
import { listCompanies } from "@/server/crm/contacts";
import { getLicenseOverview } from "@/server/billing/license";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ListFilters } from "@/modules/crm/notes-ui";
import { ProjectDialog } from "@/modules/projects/forms";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE, fullDate } from "@/modules/projects/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

const FILTERS = [
  { value: "", label: "Open projects" }, { value: "active", label: "Active" }, { value: "planning", label: "Planning" }, { value: "on_hold", label: "On hold" },
  { value: "closed", label: "Completed or cancelled" }, { value: "all", label: "All projects" }, { value: "archived", label: "Archived" },
];

function Ring({ pct }: { pct: number }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-14 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--surface-muted)" strokeWidth="5" />
        {pct > 0 && <circle cx="24" cy="24" r={r} fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} className="motion-safe:animate-draw" />}
      </svg>
      <span className="text-xs font-semibold tabular-nums">{pct}%</span>
    </span>
  );
}

async function Projects({ params, searchParams }: PageProps<"/[organizationSlug]/projects">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "projects.project.read")) return <PermissionDenied what="projects" />;
  const base = `/${ctx.organization.slug}/projects`;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const f = typeof sp.status === "string" ? sp.status : "";
  const archived = f === "archived";
  const status = (["active", "planning", "on_hold", "closed", "all"] as const).includes(f as never) ? (f as ProjectStatus | "closed" | "all") : archived ? "all" : "open";
  const mine = sp.mine === "1";
  const canCreate = can(ctx, "projects.project.create");
  const [projects, people, companies, { license }, openAll] = await Promise.all([
    listProjects(ctx, { status, archived, query, mine }),
    canCreate ? listProjectPeople(ctx) : [],
    canCreate && can(ctx, "crm.contact.read") ? listCompanies(ctx) : null,
    getLicenseOverview(ctx.organizationId),
    canCreate ? listProjects(ctx, { status: "open" }) : null,
  ]);
  const max = license?.entitlements.maxActiveProjects ?? null;
  const tz = ctx.organization.timezone;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const filtered = Boolean(query || f || mine);

  const add = canCreate ? (
    <ProjectDialog slug={ctx.organization.slug} me={ctx.memberId} people={people} companies={companies ? companies.map((c) => ({ id: c.id, name: c.name })) : null}
      trigger={<Button><Plus />New project</Button>} />
  ) : undefined;

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="Projects" description={can(ctx, "projects.project.update") ? "Every project in the workspace, with its team and progress." : "The projects you're on."}
        actions={add} />
      {canCreate && max !== null && openAll && (
        <p className="text-xs text-muted-foreground">{openAll.length} of {max} active projects on the {license?.planName} plan.</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1"><ListFilters placeholder="Search projects or clients" select={{ key: "status", label: "Filter projects", options: FILTERS }} /></div>
        {can(ctx, "projects.project.update") && (
          <div role="group" aria-label="Whose projects" className="inline-flex shrink-0 rounded-lg border border-border bg-surface p-0.5">
            {[{ k: false, l: "Everyone's" }, { k: true, l: "Mine" }].map((o) => (
              <Link key={o.l} href={o.k ? `${base}?mine=1${f ? `&status=${f}` : ""}` : `${base}${f ? `?status=${f}` : ""}`} aria-current={o.k === mine ? "true" : undefined}
                className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", o.k === mine ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-surface-muted")}>{o.l}</Link>
            ))}
          </div>
        )}
      </div>
      {projects.length === 0 ? (
        <Card><EmptyState icon={FolderKanban} title={filtered ? "No projects match" : "No projects yet"}
          description={filtered ? "Try a different search or filter." : canCreate ? "Start a project, or turn a won deal into one from the CRM." : "Projects you're added to show up here."}
          action={!filtered ? add : undefined} /></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p, i) => {
            const pct = p.tasks.total ? Math.round((p.tasks.done / p.tasks.total) * 100) : 0;
            const late = !!p.dueDate && p.dueDate < today && !["completed", "cancelled"].includes(p.status);
            return (
              <li key={p.id} className="motion-safe:animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                <Link href={`${base}/${p.id}`} className="group block h-full rounded-xl">
                  <Card className="flex h-full flex-col p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={PROJECT_STATUS_TONE[p.status]}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
                          {p.archived && <Badge>Archived</Badge>}
                        </div>
                        <p className="mt-2 truncate text-base font-semibold group-hover:underline">{p.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{p.company?.name ?? "Internal project"}</p>
                      </div>
                      <Ring pct={pct} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{p.tasks.done}/{p.tasks.total} tasks done</span>
                      {p.tasks.overdue > 0 && <span className="inline-flex items-center gap-1 font-medium text-danger"><AlertTriangle className="size-3.5" aria-hidden />{p.tasks.overdue} overdue</span>}
                      {p.dueDate && <span className={cn("inline-flex items-center gap-1", late && "font-medium text-danger")}><CalendarDays className="size-3.5" aria-hidden />Due {fullDate(p.dueDate)}</span>}
                    </div>
                    <div className="mt-auto flex items-center pt-4">
                      <div className="flex -space-x-1">
                        {p.members.slice(0, 5).map((m) => <Avatar key={m.id} name={m.name} size="sm" className="ring-2 ring-surface" />)}
                      </div>
                      {p.memberCount > 5 && <span className="ml-2 text-xs text-muted-foreground">+{p.memberCount - 5}</span>}
                      {p.owner && <span className="ml-auto truncate text-xs text-muted-foreground">Lead: {p.owner.name}</span>}
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function ProjectsPage(props: PageProps<"/[organizationSlug]/projects">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-10" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" /></div></div>}><Projects {...props} /></Suspense>;
}
