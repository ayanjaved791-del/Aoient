import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getDb } from "@/server/database/client";
import { PeopleNav } from "@/modules/people/people-nav";

async function Nav({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}/projects`;
  const open = can(ctx, "projects.task.read")
    ? (await getDb()<{ n: number }[]>`
        select count(*)::int as n from project_task t join project p on p.id = t.project_id
        where t.organization_id = ${ctx.organizationId} and t.assignee_member_id = ${ctx.memberId} and t.status <> 'done' and p.archived_at is null`)[0].n
    : null;
  const items = [
    ...(can(ctx, "projects.project.read") ? [{ href: base, label: "Projects", exact: true }] : []),
    ...(can(ctx, "projects.task.read") ? [{ href: `${base}/my-tasks`, label: "My tasks", badge: open }] : []),
    ...(can(ctx, "projects.project.update") ? [{ href: `${base}/workload`, label: "Workload" }] : []),
  ];
  return items.length > 1 ? <PeopleNav items={items} label="Projects" /> : null;
}

export default function ProjectsLayout({ children, params }: LayoutProps<"/[organizationSlug]/projects">) {
  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <Suspense fallback={<div className="h-11 border-b border-border" />}><Nav params={params} /></Suspense>
      {children}
    </div>
  );
}
