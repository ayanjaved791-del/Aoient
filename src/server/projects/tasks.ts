import "server-only";
import { getDb, transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { commentSchema, moveTaskSchema, taskSchema, type TASK_PRIORITIES, type TASK_STATUSES } from "@/lib/validation/projects";
import { projectFor, visibleProject } from "./shared";

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface TaskRow {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: { id: string; name: string } | null;
  milestone: { id: string; name: string } | null;
  dueDate: string | null;
  position: number;
  comments: number;
  completedAt: Date | null;
  createdAt: Date;
  /** Whether this person may edit or move the task. */
  canEdit: boolean;
}

type TaskDb = {
  id: string; project_id: string; project_name: string; title: string; description: string | null; status: TaskStatus; priority: TaskPriority;
  assignee_id: string | null; assignee_name: string | null; milestone_id: string | null; milestone_name: string | null; due_date: string | null;
  position: number; comments: number; completed_at: Date | null; created_at: Date; created_by_id: string | null;
};

/** You can edit any task with projects.task.update; otherwise the ones assigned to you or that you created. */
const mayEdit = (ctx: OrgContext, r: { assignee_id: string | null; created_by_id: string | null }) =>
  can(ctx, "projects.task.update") || r.assignee_id === ctx.memberId || r.created_by_id === ctx.userId;

const toTask = (ctx: OrgContext) => (r: TaskDb): TaskRow => ({
  id: r.id, projectId: r.project_id, projectName: r.project_name, title: r.title, description: r.description, status: r.status, priority: r.priority,
  assignee: r.assignee_id ? { id: r.assignee_id, name: r.assignee_name ?? "Former member" } : null,
  milestone: r.milestone_id ? { id: r.milestone_id, name: r.milestone_name! } : null,
  dueDate: r.due_date, position: r.position, comments: r.comments, completedAt: r.completed_at, createdAt: r.created_at, canEdit: mayEdit(ctx, r),
});

function taskQuery(sql: Db, ctx: OrgContext, where: ReturnType<Db>, order = sql`t.status, t.position, t.created_at`) {
  return sql<TaskDb[]>`
    select t.id, t.project_id, p.name as project_name, t.title, t.description, t.status, t.priority, t.position, t.completed_at, t.created_at, t.created_by_id,
      to_char(t.due_date, 'YYYY-MM-DD') as due_date, m.id as assignee_id, coalesce(pr.name, pr.email) as assignee_name, ms.id as milestone_id, ms.name as milestone_name,
      (select count(*)::int from project_task_comment c where c.task_id = t.id) as comments
    from project_task t
    join project p on p.id = t.project_id and p.organization_id = t.organization_id
    left join organization_member m on m.id = t.assignee_member_id and m.organization_id = t.organization_id
    left join profile pr on pr.id = m.user_id
    left join project_milestone ms on ms.id = t.milestone_id and ms.organization_id = t.organization_id
    where t.organization_id = ${ctx.organizationId} and ${visibleProject(sql, ctx)} and ${where}
    order by ${order}
    limit 2000`;
}

export async function listTasks(ctx: OrgContext, projectId: string): Promise<TaskRow[]> {
  assertPermission(ctx, "projects.task.read");
  const sql = getDb();
  const p = await projectFor(sql, ctx, projectId);
  return (await taskQuery(sql, ctx, sql`t.project_id = ${p.id}`)).map(toTask(ctx));
}

/** Tasks assigned to you across the projects you can see; finished ones only from the last 7 days. */
export async function listMyTasks(ctx: OrgContext): Promise<TaskRow[]> {
  assertPermission(ctx, "projects.task.read");
  const sql = getDb();
  return (await taskQuery(sql, ctx, sql`t.assignee_member_id = ${ctx.memberId} and p.archived_at is null
      and (t.status <> 'done' or t.completed_at >= now() - interval '7 days')`, sql`t.due_date nulls last, t.priority desc, t.created_at`)).map(toTask(ctx));
}

export interface TaskDetail extends TaskRow { thread: { id: string; body: string; author: string; mine: boolean; createdAt: Date }[]; createdBy: string | null }

export async function getTask(ctx: OrgContext, id: string): Promise<TaskDetail> {
  assertPermission(ctx, "projects.task.read");
  if (!isUuid(id)) throw new NotFoundError("Task not found");
  const sql = getDb();
  const [row] = await taskQuery(sql, ctx, sql`t.id = ${id}`);
  if (!row) throw new NotFoundError("Task not found");
  const [thread, [creator]] = await Promise.all([
    sql<{ id: string; body: string; author: string | null; author_id: string | null; created_at: Date }[]>`
      select c.id, c.body, coalesce(p.name, p.email) as author, c.author_id, c.created_at from project_task_comment c
      left join profile p on p.id = c.author_id where c.task_id = ${id} and c.organization_id = ${ctx.organizationId} order by c.created_at`,
    sql<{ name: string | null }[]>`select coalesce(name, email) as name from profile where id = ${row.created_by_id}`,
  ]);
  return {
    ...toTask(ctx)(row), createdBy: creator?.name ?? null,
    thread: thread.map((c) => ({ id: c.id, body: c.body, author: c.author ?? "Former member", mine: c.author_id === ctx.userId, createdAt: c.created_at })),
  };
}

/** Assignees must be on the project's team. Assigning someone other than yourself needs projects.task.assign. */
async function checkAssignee(tx: Db, ctx: OrgContext, projectId: string, assignee: string | null, previous: string | null) {
  if (!assignee || assignee === previous) return;
  if (assignee !== ctx.memberId) assertPermission(ctx, "projects.task.assign");
  if (!isUuid(assignee)) throw new ValidationError("Pick someone on this project", { assignee: ["Pick someone on this project"] });
  const [m] = await tx`select 1 from project_member pm join organization_member om on om.id = pm.member_id and om.status = 'active'
    where pm.project_id = ${projectId} and pm.member_id = ${assignee} and pm.organization_id = ${ctx.organizationId}`;
  if (!m) throw new ValidationError("Add them to the project team first", { assignee: ["Add them to the project team first"] });
}

async function checkMilestone(tx: Db, ctx: OrgContext, projectId: string, milestoneId: string | null) {
  if (!milestoneId) return;
  if (!isUuid(milestoneId)) throw new ValidationError("Pick a milestone from this project", { milestone: ["Pick a milestone from this project"] });
  const [m] = await tx`select 1 from project_milestone where id = ${milestoneId} and project_id = ${projectId} and organization_id = ${ctx.organizationId}`;
  if (!m) throw new ValidationError("Pick a milestone from this project", { milestone: ["Pick a milestone from this project"] });
}

async function lastPosition(tx: Db, projectId: string, status: TaskStatus) {
  const [{ pos }] = await tx<{ pos: number }[]>`select coalesce(max(position), 0) + 1024 as pos from project_task where project_id = ${projectId} and status = ${status}`;
  return pos;
}

export async function createTask(ctx: OrgContext, projectId: string, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "projects.task.create");
  const d = parseInput(taskSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const p = await projectFor(tx, ctx, projectId);
    if (p.archived) throw new ValidationError("Restore this project before adding tasks.");
    await checkAssignee(tx, ctx, p.id, d.assigneeMemberId, null);
    await checkMilestone(tx, ctx, p.id, d.milestoneId);
    const [row] = await tx<{ id: string }[]>`
      insert into project_task (organization_id, project_id, milestone_id, title, description, status, priority, assignee_member_id, due_date, position, completed_at, created_by_id)
      values (${ctx.organizationId}, ${p.id}, ${d.milestoneId}, ${d.title}, ${d.description}, ${d.status}, ${d.priority}, ${d.assigneeMemberId}, ${d.dueDate},
        ${await lastPosition(tx, p.id, d.status)}, ${d.status === "done" ? tx`now()` : null}, ${ctx.userId})
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.task_created", targetType: "project_task", targetId: row.id, metadata: { title: d.title, project: p.name } });
    return row;
  });
}

async function taskForEdit(tx: Db, ctx: OrgContext, id: string) {
  if (!isUuid(id)) throw new NotFoundError("Task not found");
  const [t] = await tx<{ project_id: string; title: string; status: TaskStatus; assignee_id: string | null; created_by_id: string | null }[]>`
    select project_id, title, status, assignee_member_id as assignee_id, created_by_id from project_task
    where id = ${id} and organization_id = ${ctx.organizationId} for update`;
  if (!t) throw new NotFoundError("Task not found");
  const p = await projectFor(tx, ctx, t.project_id).catch(() => { throw new NotFoundError("Task not found"); });
  if (!mayEdit(ctx, t)) throw new ForbiddenError("You can only change tasks assigned to you or that you created.");
  return { ...t, project: p };
}

export async function updateTask(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "projects.task.read");
  const d = parseInput(taskSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const t = await taskForEdit(tx, ctx, id);
    await checkAssignee(tx, ctx, t.project_id, d.assigneeMemberId, t.assignee_id);
    // Taking a task off someone else also needs the assign permission.
    if (t.assignee_id && t.assignee_id !== d.assigneeMemberId && t.assignee_id !== ctx.memberId) assertPermission(ctx, "projects.task.assign");
    await checkMilestone(tx, ctx, t.project_id, d.milestoneId);
    const moved = d.status !== t.status;
    await tx`
      update project_task set title = ${d.title}, description = ${d.description}, status = ${d.status}, priority = ${d.priority},
        assignee_member_id = ${d.assigneeMemberId}, milestone_id = ${d.milestoneId}, due_date = ${d.dueDate},
        position = ${moved ? await lastPosition(tx, t.project_id, d.status) : tx`position`},
        completed_at = ${d.status === "done" ? tx`coalesce(completed_at, now())` : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: d.status === "done" && moved ? "projects.task_completed" : "projects.task_updated", targetType: "project_task", targetId: id, metadata: { title: d.title, project: t.project.name } });
  });
}

/** Moves a card on the board: to another column, between two cards. */
export async function moveTask(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "projects.task.read");
  const d = parseInput(moveTaskSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const t = await taskForEdit(tx, ctx, id);
    const near = [d.beforeId, d.afterId].filter((x): x is string => Boolean(x) && isUuid(x!) && x !== id);
    const rows = near.length ? await tx<{ id: string; position: number }[]>`
      select id, position from project_task where id in ${tx(near)} and project_id = ${t.project_id} and status = ${d.status}` : [];
    const before = rows.find((r) => r.id === d.beforeId)?.position;
    const after = rows.find((r) => r.id === d.afterId)?.position;
    const position = before !== undefined && after !== undefined ? (before + after) / 2
      : before !== undefined ? before + 1024 : after !== undefined ? after - 1024 : await lastPosition(tx, t.project_id, d.status);
    await tx`
      update project_task set status = ${d.status}, position = ${position},
        completed_at = ${d.status === "done" ? tx`coalesce(completed_at, now())` : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    if (d.status !== t.status) {
      await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: d.status === "done" ? "projects.task_completed" : "projects.task_moved", targetType: "project_task", targetId: id, metadata: { title: t.title, project: t.project.name, status: d.status } });
    }
  });
}

export async function deleteTask(ctx: OrgContext, id: string): Promise<{ projectId: string }> {
  assertPermission(ctx, "projects.task.read");
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const t = await taskForEdit(tx, ctx, id);
    if (!can(ctx, "projects.task.update") && t.created_by_id !== ctx.userId) throw new ForbiddenError("Only the person who created this task, or a project manager, can delete it.");
    await tx`delete from project_task where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.task_deleted", targetType: "project", targetId: t.project_id, metadata: { title: t.title, project: t.project.name } });
    return { projectId: t.project_id };
  });
}

/* ─────────────────────────────── comments ─────────────────────────────── */

export async function addComment(ctx: OrgContext, taskId: string, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "projects.task.read");
  const d = parseInput(commentSchema, input);
  if (!isUuid(taskId)) throw new NotFoundError("Task not found");
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [t] = await tx<{ project_id: string; title: string }[]>`select project_id, title from project_task where id = ${taskId} and organization_id = ${ctx.organizationId}`;
    if (!t) throw new NotFoundError("Task not found");
    await projectFor(tx, ctx, t.project_id).catch(() => { throw new NotFoundError("Task not found"); });
    const [row] = await tx<{ id: string }[]>`
      insert into project_task_comment (organization_id, task_id, body, author_id) values (${ctx.organizationId}, ${taskId}, ${d.body}, ${ctx.userId}) returning id`;
    // The audit entry names the task, never the comment's words.
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "projects.comment_added", targetType: "project_task", targetId: taskId, metadata: { title: t.title } });
    return row;
  });
}

export async function deleteComment(ctx: OrgContext, id: string): Promise<void> {
  if (!isUuid(id)) throw new NotFoundError("Comment not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const res = await tx`delete from project_task_comment where id = ${id} and organization_id = ${ctx.organizationId} and author_id = ${ctx.userId}`;
    if (res.count === 0) throw new NotFoundError("Comment not found");
  });
}
