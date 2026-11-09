import "server-only";
import { getDb, transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { isUniqueViolation } from "@/server/database/errors";
import { ConflictError, NotFoundError, PlanLimitError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { milestoneSchema, projectSchema, type PROJECT_STATUSES } from "@/lib/validation/projects";
import { assertActiveMembers, OPEN_PROJECT_STATUSES, projectFor, seesAllProjects, visibleProject } from "./shared";

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  company: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  startDate: string | null;
  dueDate: string | null;
  tasks: { total: number; done: number; overdue: number };
  members: { id: string; name: string }[];
  memberCount: number;
  archived: boolean;
  updatedAt: Date;
}

export interface ProjectDetail extends ProjectSummary {
  description: string | null;
  deal: { id: string; title: string } | null;
  milestones: { id: string; name: string; dueDate: string | null; completedAt: Date | null; total: number; done: number }[];
  isMember: boolean;
}

type SummaryRow = {
  id: string; name: string; status: ProjectStatus; company_id: string | null; company_name: string | null; owner_id: string | null; owner_name: string | null;
  start_date: string | null; due_date: string | null; total: number; done: number; overdue: number; members: { id: string; name: string }[] | null; member_count: number;
  archived: boolean; updated_at: Date;
};

function summaryQuery(sql: Db, ctx: OrgContext, where: ReturnType<Db>) {
  const tz = ctx.organization.timezone;
  return sql<SummaryRow[]>`
    select p.id, p.name, p.status, c.id as company_id, c.name as company_name, om.id as owner_id, op.name as owner_name,
      to_char(p.start_date, 'YYYY-MM-DD') as start_date, to_char(p.due_date, 'YYYY-MM-DD') as due_date,
      p.archived_at is not null as archived, p.updated_at,
      (select count(*)::int from project_task t where t.project_id = p.id) as total,
      (select count(*)::int from project_task t where t.project_id = p.id and t.status = 'done') as done,
      (select count(*)::int from project_task t where t.project_id = p.id and t.status <> 'done' and t.due_date < (now() at time zone ${tz})::date) as overdue,
      (select count(*)::int from project_member m where m.project_id = p.id) as member_count,
      (select json_agg(json_build_object('id', x.id, 'name', x.name)) from (
         select m.member_id as id, coalesce(pr.name, pr.email) as name from project_member m
         join organization_member om2 on om2.id = m.member_id join profile pr on pr.id = om2.user_id
         where m.project_id = p.id order by m.added_at limit 6) x) as members
    from project p
    left join crm_company c on c.id = p.company_id and c.organization_id = p.organization_id
    left join organization_member om on om.id = p.owner_member_id and om.organization_id = p.organization_id
    left join profile op on op.id = om.user_id
    where p.organization_id = ${ctx.organizationId} and ${visibleProject(sql, ctx)} and ${where}
    order by case p.status when 'active' then 0 when 'planning' then 1 when 'on_hold' then 2 else 3 end, p.due_date nulls last, lower(p.name)
    limit 500`;
}

const toSummary = (r: SummaryRow): ProjectSummary => ({
  id: r.id, name: r.name, status: r.status,
  company: r.company_id ? { id: r.company_id, name: r.company_name! } : null,
  owner: r.owner_id ? { id: r.owner_id, name: r.owner_name ?? "Former member" } : null,
  startDate: r.start_date, dueDate: r.due_date, tasks: { total: r.total, done: r.done, overdue: r.overdue },
  members: r.members ?? [], memberCount: r.member_count, archived: r.archived, updatedAt: r.updated_at,
});

export async function listProjects(ctx: OrgContext, opts: { status?: "open" | "closed" | "all" | ProjectStatus; archived?: boolean; mine?: boolean; query?: string; companyId?: string } = {}): Promise<ProjectSummary[]> {
  assertPermission(ctx, "projects.project.read");
  const sql = getDb();
  const status = opts.status ?? "open";
  const q = opts.query?.trim() ? `%${opts.query.trim().toLowerCase()}%` : null;
  if (opts.companyId && !isUuid(opts.companyId)) return [];
  const rows = await summaryQuery(sql, ctx, sql`
    ${opts.archived ? sql`p.archived_at is not null` : sql`p.archived_at is null`}
    ${status === "open" ? sql`and p.status in ${sql([...OPEN_PROJECT_STATUSES])}` : status === "closed" ? sql`and p.status in ('completed', 'cancelled')` : status === "all" ? sql`` : sql`and p.status = ${status}`}
    ${opts.mine ? sql`and exists (select 1 from project_member mm where mm.project_id = p.id and mm.member_id = ${ctx.memberId})` : sql``}
    ${opts.companyId ? sql`and p.company_id = ${opts.companyId}` : sql``}
    ${q ? sql`and (lower(p.name) like ${q} or lower(coalesce(c.name, '')) like ${q})` : sql``}`);
  return rows.map(toSummary);
}

export async function getProject(ctx: OrgContext, id: string): Promise<ProjectDetail> {
  assertPermission(ctx, "projects.project.read");
  const sql = getDb();
  const access = await projectFor(sql, ctx, id);
  const [[row], [extra], milestones, members] = await Promise.all([
    summaryQuery(sql, ctx, sql`p.id = ${id}`),
    sql<{ description: string | null; deal_id: string | null; deal_title: string | null }[]>`
      select p.description, d.id as deal_id, d.title as deal_title from project p
      left join crm_deal d on d.id = p.deal_id and d.organization_id = p.organization_id
      where p.id = ${id} and p.organization_id = ${ctx.organizationId}`,
    sql<{ id: string; name: string; due_date: string | null; completed_at: Date | null; total: number; done: number }[]>`
      select ms.id, ms.name, to_char(ms.due_date, 'YYYY-MM-DD') as due_date, ms.completed_at,
        (select count(*)::int from project_task t where t.milestone_id = ms.id) as total,
        (select count(*)::int from project_task t where t.milestone_id = ms.id and t.status = 'done') as done
      from project_milestone ms where ms.project_id = ${id} and ms.organization_id = ${ctx.organizationId}
      order by ms.due_date nulls last, ms.created_at`,
    sql<{ id: string; name: string }[]>`
      select m.member_id as id, coalesce(pr.name, pr.email) as name from project_member m
      join organization_member om on om.id = m.member_id join profile pr on pr.id = om.user_id
      where m.project_id = ${id} and m.organization_id = ${ctx.organizationId} order by lower(coalesce(pr.name, pr.email))`,
  ]);
  return {
    ...toSummary(row), members,
    description: extra.description,
    // The deal is only named to people who can see deals.
    deal: extra.deal_id && can(ctx, "crm.deal.read") ? { id: extra.deal_id, title: extra.deal_title! } : null,
    milestones: milestones.map((m) => ({ id: m.id, name: m.name, dueDate: m.due_date, completedAt: m.completed_at, total: m.total, done: m.done })),
    isMember: access.isMember,
  };
}

async function assertLinks(tx: Db, ctx: OrgContext, companyId: string | null, dealId: string | null) {
  if (companyId) {
    assertPermission(ctx, "crm.contact.read");
    if (!isUuid(companyId)) throw new ValidationError("Pick a valid client", { company: ["Pick a valid client"] });
    const [c] = await tx`select 1 from crm_company where id = ${companyId} and organization_id = ${ctx.organizationId}`;
    if (!c) throw new ValidationError("Pick a valid client", { company: ["Pick a valid client"] });
  }
  if (dealId) {
    assertPermission(ctx, "crm.deal.read");
    if (!isUuid(dealId)) throw new ValidationError("Pick a valid deal", { deal: ["Pick a valid deal"] });
    const [d] = await tx`select 1 from crm_deal where id = ${dealId} and organization_id = ${ctx.organizationId}`;
    if (!d) throw new ValidationError("Pick a valid deal", { deal: ["Pick a valid deal"] });
  }
}

/** The plan's active-project limit counts projects that are planning, active or on hold. */
async function assertProjectRoom(tx: Db, organizationId: string, exceptId?: string) {
  const license = await assertWritable(tx, organizationId);
  const max = license.entitlements.maxActiveProjects;
  if (max === null) return;
  const [{ n }] = await tx<{ n: number }[]>`
    select count(*)::int as n from project where organization_id = ${organizationId} and archived_at is null
      and status in ${tx([...OPEN_PROJECT_STATUSES])} ${exceptId ? tx`and id <> ${exceptId}` : tx``}`;
  if (n >= max) throw new PlanLimitError(`The ${license.planName} plan includes ${max} active projects. Complete or archive one, or upgrade for unlimited projects.`);
}

async function setMembers(tx: Db, ctx: OrgContext, projectId: string, memberIds: string[]) {
  await assertActiveMembers(tx, ctx.organizationId, memberIds);
  const ids = [...new Set(memberIds)];
  await tx`delete from project_member where project_id = ${projectId} and organization_id = ${ctx.organizationId} ${ids.length ? tx`and member_id not in ${tx(ids)}` : tx``}`;
  for (const m of ids) {
    await tx`insert into project_member (organization_id, project_id, member_id) values (${ctx.organizationId}, ${projectId}, ${m}) on conflict do nothing`;
  }
}

export async function createProject(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "projects.project.create");
  const d = parseInput(projectSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    if ((OPEN_PROJECT_STATUSES as readonly string[]).includes(d.status)) await assertProjectRoom(tx, ctx.organizationId);
    await assertLinks(tx, ctx, d.companyId, d.dealId);
    await assertActiveMembers(tx, ctx.organizationId, [d.ownerMemberId], "owner");
    const owner = d.ownerMemberId ?? ctx.memberId;
    const [row] = await tx<{ id: string }[]>`
      insert into project (organization_id, name, description, status, company_id, deal_id, owner_member_id, start_date, due_date, created_by_id)
      values (${ctx.organizationId}, ${d.name}, ${d.description}, ${d.status}, ${d.companyId}, ${d.dealId}, ${owner}, ${d.startDate}, ${d.dueDate}, ${ctx.userId})
      returning id`;
    // The creator and the owner are always on the team.
    await setMembers(tx, ctx, row.id, [...d.memberIds, owner, ctx.memberId]);
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.project_created", targetType: "project", targetId: row.id, metadata: { name: d.name } });
    return row;
  }).catch(projectConflict);
}

export async function updateProject(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "projects.project.update");
  const d = parseInput(projectSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await projectFor(tx, ctx, id, { lock: true });
    const [cur] = await tx<{ status: ProjectStatus; deal_id: string | null; company_id: string | null }[]>`select status, deal_id, company_id from project where id = ${id}`;
    const reopening = !(OPEN_PROJECT_STATUSES as readonly string[]).includes(cur.status) && (OPEN_PROJECT_STATUSES as readonly string[]).includes(d.status);
    if (reopening) await assertProjectRoom(tx, ctx.organizationId, id);
    // Unchanged links are kept even if this person can't see the CRM.
    await assertLinks(tx, ctx, d.companyId === cur.company_id ? null : d.companyId, d.dealId === cur.deal_id ? null : d.dealId);
    await assertActiveMembers(tx, ctx.organizationId, [d.ownerMemberId], "owner");
    await tx`
      update project set name = ${d.name}, description = ${d.description}, status = ${d.status}, company_id = ${d.companyId}, deal_id = ${d.dealId},
        owner_member_id = ${d.ownerMemberId}, start_date = ${d.startDate}, due_date = ${d.dueDate}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    await setMembers(tx, ctx, id, [...d.memberIds, ...(d.ownerMemberId ? [d.ownerMemberId] : [])]);
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.project_updated", targetType: "project", targetId: id, metadata: { name: d.name, status: d.status } });
  }).catch(projectConflict);
}

export async function setProjectArchived(ctx: OrgContext, id: string, archived: boolean): Promise<void> {
  assertPermission(ctx, "projects.project.archive");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const p = await projectFor(tx, ctx, id, { lock: true });
    if (!archived) {
      const [cur] = await tx<{ status: ProjectStatus }[]>`select status from project where id = ${id}`;
      if ((OPEN_PROJECT_STATUSES as readonly string[]).includes(cur.status)) await assertProjectRoom(tx, ctx.organizationId, id);
    }
    await tx`update project set archived_at = ${archived ? tx`now()` : null}, updated_at = now() where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: archived ? "projects.project_archived" : "projects.project_restored", targetType: "project", targetId: id, metadata: { name: p.name } });
  }).catch(projectConflict);
}

/** A won deal becomes a project for its client, with the deal's owner on the team. One project per deal. */
export async function createProjectFromDeal(ctx: OrgContext, dealId: string): Promise<{ id: string; existed: boolean }> {
  assertPermission(ctx, "projects.project.create");
  assertPermission(ctx, "crm.deal.read");
  if (!isUuid(dealId)) throw new NotFoundError("Deal not found");
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [deal] = await tx<{ title: string; company_id: string | null; owner_member_id: string | null; expected_close_date: string | null }[]>`
      select title, company_id, owner_member_id, to_char(expected_close_date, 'YYYY-MM-DD') as expected_close_date
      from crm_deal where id = ${dealId} and organization_id = ${ctx.organizationId}`;
    if (!deal) throw new NotFoundError("Deal not found");
    const [existing] = await tx<{ id: string }[]>`select id from project where organization_id = ${ctx.organizationId} and deal_id = ${dealId}`;
    if (existing) return { id: existing.id, existed: true };
    await assertProjectRoom(tx, ctx.organizationId);
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from project where organization_id = ${ctx.organizationId} and archived_at is null and lower(name) = lower(${deal.title})`;
    const name = n ? `${deal.title} (${new Date().getFullYear()})` : deal.title;
    const owner = deal.owner_member_id ?? ctx.memberId;
    const [row] = await tx<{ id: string }[]>`
      insert into project (organization_id, name, status, company_id, deal_id, owner_member_id, start_date, created_by_id)
      values (${ctx.organizationId}, ${name}, 'planning', ${deal.company_id}, ${dealId}, ${owner}, (now() at time zone ${ctx.organization.timezone})::date, ${ctx.userId})
      returning id`;
    await setMembers(tx, ctx, row.id, [owner, ctx.memberId]);
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.project_created", targetType: "project", targetId: row.id, metadata: { name, fromDeal: true } });
    return { id: row.id, existed: false };
  }).catch(projectConflict);
}

function projectConflict(e: unknown): never {
  if (isUniqueViolation(e, "project_org_name")) throw new ConflictError("A project with this name already exists.");
  if (isUniqueViolation(e, "project_org_deal")) throw new ConflictError("This deal already has a project.");
  throw e;
}

/* ─────────────────────────────── milestones ─────────────────────────────── */

export async function createMilestone(ctx: OrgContext, projectId: string, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "projects.project.update");
  const d = parseInput(milestoneSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const p = await projectFor(tx, ctx, projectId);
    const [row] = await tx<{ id: string }[]>`
      insert into project_milestone (organization_id, project_id, name, due_date) values (${ctx.organizationId}, ${p.id}, ${d.name}, ${d.dueDate}) returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.milestone_created", targetType: "project", targetId: p.id, metadata: { name: d.name, project: p.name } });
    return row;
  });
}

async function milestoneProject(tx: Db, ctx: OrgContext, id: string) {
  if (!isUuid(id)) throw new NotFoundError("Milestone not found");
  const [m] = await tx<{ project_id: string; name: string }[]>`select project_id, name from project_milestone where id = ${id} and organization_id = ${ctx.organizationId}`;
  if (!m) throw new NotFoundError("Milestone not found");
  const p = await projectFor(tx, ctx, m.project_id).catch(() => { throw new NotFoundError("Milestone not found"); });
  return { ...m, project: p };
}

export async function updateMilestone(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "projects.project.update");
  const d = parseInput(milestoneSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const m = await milestoneProject(tx, ctx, id);
    await tx`update project_milestone set name = ${d.name}, due_date = ${d.dueDate}, updated_at = now() where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.milestone_updated", targetType: "project", targetId: m.project_id, metadata: { name: d.name, project: m.project.name } });
  });
}

export async function setMilestoneDone(ctx: OrgContext, id: string, done: boolean): Promise<void> {
  assertPermission(ctx, "projects.project.update");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const m = await milestoneProject(tx, ctx, id);
    await tx`update project_milestone set completed_at = ${done ? tx`now()` : null}, updated_at = now() where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.milestone_updated", targetType: "project", targetId: m.project_id, metadata: { name: m.name, project: m.project.name, done } });
  });
}

export async function deleteMilestone(ctx: OrgContext, id: string): Promise<void> {
  assertPermission(ctx, "projects.project.update");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const m = await milestoneProject(tx, ctx, id);
    await tx`delete from project_milestone where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.milestone_deleted", targetType: "project", targetId: m.project_id, metadata: { name: m.name, project: m.project.name } });
  });
}

/* ─────────────────────────────── workload ─────────────────────────────── */

export interface WorkloadRow { memberId: string; name: string; open: number; overdue: number; dueThisWeek: number; inProgress: number; doneLast7: number; projects: number }

/** Open work per active member, across every project. For people who manage projects. */
export async function getWorkload(ctx: OrgContext): Promise<WorkloadRow[]> {
  assertPermission(ctx, "projects.project.update");
  const tz = ctx.organization.timezone;
  const rows = await getDb()<{ member_id: string; name: string; open: number; overdue: number; week: number; in_progress: number; done7: number; projects: number }[]>`
    select m.id as member_id, coalesce(p.name, p.email) as name,
      count(t.id) filter (where t.status <> 'done')::int as open,
      count(t.id) filter (where t.status <> 'done' and t.due_date < (now() at time zone ${tz})::date)::int as overdue,
      count(t.id) filter (where t.status <> 'done' and t.due_date between (now() at time zone ${tz})::date and (now() at time zone ${tz})::date + 6)::int as week,
      count(t.id) filter (where t.status = 'in_progress')::int as in_progress,
      count(t.id) filter (where t.status = 'done' and t.completed_at >= now() - interval '7 days')::int as done7,
      (select count(*)::int from project_member pm join project pj on pj.id = pm.project_id
         where pm.member_id = m.id and pj.archived_at is null and pj.status in ('planning', 'active', 'on_hold')) as projects
    from organization_member m
    join profile p on p.id = m.user_id
    left join project_task t on t.assignee_member_id = m.id and t.organization_id = m.organization_id
      and exists (select 1 from project pj where pj.id = t.project_id and pj.archived_at is null)
    where m.organization_id = ${ctx.organizationId} and m.status = 'active'
    group by m.id, p.name, p.email
    order by count(t.id) filter (where t.status <> 'done') desc, lower(coalesce(p.name, p.email))`;
  return rows.map((r) => ({ memberId: r.member_id, name: r.name, open: r.open, overdue: r.overdue, dueThisWeek: r.week, inProgress: r.in_progress, doneLast7: r.done7, projects: r.projects }));
}

export { seesAllProjects };

/** Active members, for picking a project team (names only). */
export async function listProjectPeople(ctx: OrgContext): Promise<{ id: string; name: string }[]> {
  assertPermission(ctx, "projects.project.read");
  return getDb()<{ id: string; name: string }[]>`
    select m.id, coalesce(p.name, p.email) as name
    from organization_member m join profile p on p.id = m.user_id
    where m.organization_id = ${ctx.organizationId} and m.status = 'active'
    order by lower(coalesce(p.name, p.email))`;
}

/** The project made from a deal, if this person can see it. */
export async function projectIdForDeal(ctx: OrgContext, dealId: string): Promise<string | null> {
  if (!can(ctx, "projects.project.read") || !isUuid(dealId)) return null;
  const sql = getDb();
  const [row] = await sql<{ id: string }[]>`
    select p.id from project p where p.organization_id = ${ctx.organizationId} and p.deal_id = ${dealId} and ${visibleProject(sql, ctx)}`;
  return row?.id ?? null;
}
