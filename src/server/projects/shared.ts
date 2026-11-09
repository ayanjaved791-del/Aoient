import "server-only";
import type { Db } from "@/server/database/client";
import { can, type OrgContext } from "@/server/tenancy/context";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";

/**
 * Who sees which project: people who can edit projects (project managers,
 * admins, owners) see every project; everyone else sees the projects they're
 * a member of. Anything outside that reads as "not found".
 */
export const seesAllProjects = (ctx: OrgContext) => can(ctx, "projects.project.update");

export function visibleProject(sql: Db, ctx: OrgContext, alias = "p") {
  return seesAllProjects(ctx)
    ? sql`true`
    : sql`exists (select 1 from project_member vm where vm.project_id = ${sql(alias)}.id and vm.member_id = ${ctx.memberId})`;
}

export interface ProjectAccess { id: string; name: string; archived: boolean; isMember: boolean }

/** Loads a project the person may see, or throws NOT_FOUND. */
export async function projectFor(sql: Db, ctx: OrgContext, projectId: string, opts: { lock?: boolean } = {}): Promise<ProjectAccess> {
  if (!isUuid(projectId)) throw new NotFoundError("Project not found");
  const [row] = await sql<{ id: string; name: string; archived: boolean; is_member: boolean }[]>`
    select p.id, p.name, p.archived_at is not null as archived,
      exists (select 1 from project_member m where m.project_id = p.id and m.member_id = ${ctx.memberId}) as is_member
    from project p
    where p.id = ${projectId} and p.organization_id = ${ctx.organizationId} and ${visibleProject(sql, ctx)}
    ${opts.lock ? sql`for update of p` : sql``}`;
  if (!row) throw new NotFoundError("Project not found");
  return { id: row.id, name: row.name, archived: row.archived, isMember: row.is_member };
}

/** Member ids from the browser must be active members of this organization. */
export async function assertActiveMembers(tx: Db, organizationId: string, ids: (string | null)[], field = "members") {
  const list = [...new Set(ids.filter(Boolean) as string[])];
  if (list.length === 0) return;
  if (list.some((i) => !isUuid(i))) throw new ValidationError("Pick valid people", { [field]: ["Pick valid people"] });
  const rows = await tx<{ id: string }[]>`select id from organization_member where organization_id = ${organizationId} and status = 'active' and id in ${tx(list)}`;
  if (rows.length !== list.length) throw new ValidationError("Pick valid people", { [field]: ["Pick valid people"] });
}

export const OPEN_PROJECT_STATUSES = ["planning", "active", "on_hold"] as const;
