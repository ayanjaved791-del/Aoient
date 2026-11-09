/** Projects: who sees which project, tasks and who may change them, plan limits, and one organization at a time. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase, setLicense } from "../support/db";
import { ConflictError, ForbiddenError, NotFoundError, PlanLimitError, ValidationError } from "@/lib/errors";
import { createMilestone, createProject, createProjectFromDeal, getProject, getWorkload, listProjects, setMilestoneDone, setProjectArchived, updateProject } from "@/server/projects/projects";
import { addComment, createTask, deleteComment, deleteTask, getTask, listMyTasks, listTasks, moveTask, updateTask } from "@/server/projects/tasks";
import { createCompany } from "@/server/crm/contacts";
import { createDeal, listStages, moveDeal } from "@/server/crm/deals";

async function setup() {
  const a = await createOrgWithOwner("prj-a");
  const pm = await addMember(a.org.id, "project_manager");
  const dev = await addMember(a.org.id, "employee");
  const other = await addMember(a.org.id, "employee");
  const guest = await addMember(a.org.id, "guest");
  const sales = await addMember(a.org.id, "sales_manager");
  const b = await createOrgWithOwner("prj-b");
  const bProject = await createProject(b.ctx, { name: "Bravo secret project" });
  const bTask = await createTask(b.ctx, bProject.id, { title: "Bravo hidden task" });
  return { a, pm, dev, other, guest, sales, b, bProject, bTask };
}

describe("projects", () => {
  beforeEach(resetDatabase);

  it("runs a project: team, milestones, tasks on a board, comments, my tasks and workload", async () => {
    const s = await setup();
    const p = await createProject(s.pm.ctx, { name: "Website relaunch", memberIds: [s.dev.member.id], dueDate: "2026-12-31" });
    const ms = await createMilestone(s.pm.ctx, p.id, { name: "Design signed off", dueDate: "2026-11-30" });
    const t1 = await createTask(s.pm.ctx, p.id, { title: "Wireframes", assigneeMemberId: s.dev.member.id, milestoneId: ms.id, priority: "high", dueDate: "2020-01-01" });
    const t2 = await createTask(s.pm.ctx, p.id, { title: "Copy", assigneeMemberId: s.dev.member.id });
    const t3 = await createTask(s.dev.ctx, p.id, { title: "Logo research" });

    const detail = await getProject(s.dev.ctx, p.id);
    expect(detail.members.map((m) => m.id).sort()).toEqual([s.pm.member.id, s.dev.member.id].sort());
    expect(detail.tasks).toEqual({ total: 3, done: 0, overdue: 1 });
    expect(detail.milestones).toEqual([expect.objectContaining({ name: "Design signed off", total: 1, done: 0 })]);

    // Move cards: into progress, then between two cards, then done.
    await moveTask(s.dev.ctx, t1.id, { status: "in_progress" });
    await moveTask(s.dev.ctx, t2.id, { status: "in_progress" });
    await moveTask(s.dev.ctx, t3.id, { status: "in_progress", beforeId: t1.id, afterId: t2.id });
    const board = (await listTasks(s.dev.ctx, p.id)).filter((t) => t.status === "in_progress").map((t) => t.title);
    expect(board).toEqual(["Wireframes", "Logo research", "Copy"]);
    await moveTask(s.dev.ctx, t1.id, { status: "done" });
    expect((await getTask(s.dev.ctx, t1.id)).completedAt).toBeInstanceOf(Date);
    expect((await getProject(s.pm.ctx, p.id)).milestones[0]).toMatchObject({ total: 1, done: 1 });
    await setMilestoneDone(s.pm.ctx, ms.id, true);

    const c = await addComment(s.dev.ctx, t2.id, { body: "Draft is in the shared folder" });
    expect((await getTask(s.pm.ctx, t2.id)).thread.map((x) => x.body)).toEqual(["Draft is in the shared folder"]);
    await expect(deleteComment(s.pm.ctx, c.id)).rejects.toBeInstanceOf(NotFoundError);
    await deleteComment(s.dev.ctx, c.id);

    expect((await listMyTasks(s.dev.ctx)).map((t) => t.title).sort()).toEqual(["Copy", "Wireframes"]);
    const load = await getWorkload(s.pm.ctx);
    expect(load.find((w) => w.memberId === s.dev.member.id)).toMatchObject({ open: 1, inProgress: 1, doneLast7: 1, projects: 1 });

    // Audit entries never hold the comment's words.
    const audit = await db()<{ metadata: unknown }[]>`select metadata from audit_log where action = 'projects.comment_added'`;
    expect(JSON.stringify(audit)).not.toContain("shared folder");
  });

  it("shows employees only the projects they're on, and lets them change only their own tasks", async () => {
    const s = await setup();
    const mine = await createProject(s.pm.ctx, { name: "On the team", memberIds: [s.dev.member.id] });
    const notMine = await createProject(s.pm.ctx, { name: "Not on the team" });
    const pmTask = await createTask(s.pm.ctx, mine.id, { title: "PM's task", assigneeMemberId: s.pm.member.id });

    expect((await listProjects(s.dev.ctx)).map((p) => p.name)).toEqual(["On the team"]);
    expect((await listProjects(s.pm.ctx)).map((p) => p.name).sort()).toEqual(["Not on the team", "On the team"]);
    await expect(getProject(s.dev.ctx, notMine.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listTasks(s.dev.ctx, notMine.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createTask(s.dev.ctx, notMine.id, { title: "Sneak in" })).rejects.toBeInstanceOf(NotFoundError);

    // Employees can't edit others' tasks, assign other people, or change projects.
    await expect(moveTask(s.dev.ctx, pmTask.id, { status: "done" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteTask(s.dev.ctx, pmTask.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createTask(s.dev.ctx, mine.id, { title: "For PM", assigneeMemberId: s.pm.member.id })).rejects.toBeInstanceOf(ForbiddenError);
    const own = await createTask(s.dev.ctx, mine.id, { title: "Mine", assigneeMemberId: s.dev.member.id });
    await updateTask(s.dev.ctx, own.id, { title: "Mine, renamed", assigneeMemberId: s.dev.member.id, status: "review" });
    await deleteTask(s.dev.ctx, own.id);
    await expect(updateProject(s.dev.ctx, mine.id, { name: "Hijack" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createProject(s.dev.ctx, { name: "Nope" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getWorkload(s.dev.ctx)).rejects.toBeInstanceOf(ForbiddenError);

    // Assignees must be on the team.
    await expect(createTask(s.pm.ctx, mine.id, { title: "Off team", assigneeMemberId: s.other.member.id })).rejects.toBeInstanceOf(ValidationError);
    // Guests see nothing.
    await expect(listProjects(s.guest.ctx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listMyTasks(s.guest.ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("never reads, changes or links another organization's projects", async () => {
    const s = await setup();
    const p = await createProject(s.a.ctx, { name: "Alpha" });
    expect(JSON.stringify(await listProjects(s.a.ctx, { status: "all" }))).not.toContain("Bravo");
    await expect(getProject(s.a.ctx, s.bProject.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateProject(s.a.ctx, s.bProject.id, { name: "Hijack" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setProjectArchived(s.a.ctx, s.bProject.id, true)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createTask(s.a.ctx, s.bProject.id, { title: "x task" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(getTask(s.a.ctx, s.bTask.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(moveTask(s.a.ctx, s.bTask.id, { status: "done" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(addComment(s.a.ctx, s.bTask.id, { body: "peek" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(createMilestone(s.a.ctx, s.bProject.id, { name: "x milestone" })).rejects.toBeInstanceOf(NotFoundError);
    // Foreign people, clients and deals are refused.
    await expect(createProject(s.a.ctx, { name: "Team from B", memberIds: [s.b.ctx.memberId] })).rejects.toBeInstanceOf(ValidationError);
    const bCo = await createCompany(s.b.ctx, { name: "Bravo client" });
    await expect(createProject(s.a.ctx, { name: "Client from B", companyId: bCo.id })).rejects.toBeInstanceOf(ValidationError);
    // The database refuses a hand-written cross-organization link too.
    await expect(db()`insert into project_member (organization_id, project_id, member_id) values (${s.a.org.id}, ${p.id}, ${s.b.ctx.memberId})`).rejects.toThrow(/foreign key/);
    await expect(db()`update project_task set project_id = ${p.id} where id = ${s.bTask.id}`).rejects.toThrow(/foreign key/);
    expect((await getTask(s.b.ctx, s.bTask.id)).title).toBe("Bravo hidden task");
  });

  it("enforces the plan's active-project limit", async () => {
    const s = await setup();
    await setLicense(s.a.org.id, { plan: "medisea", status: "active" });
    for (let i = 1; i <= 10; i++) await createProject(s.a.ctx, { name: `Project ${i}` });
    await expect(createProject(s.a.ctx, { name: "Project 11" })).rejects.toBeInstanceOf(PlanLimitError);
    // Completed projects and planning-as-done don't count; closing one frees a slot.
    await createProject(s.a.ctx, { name: "Already done", status: "completed" });
    const first = (await listProjects(s.a.ctx)).find((p) => p.name === "Project 1")!;
    await updateProject(s.a.ctx, first.id, { name: "Project 1", status: "completed" });
    await createProject(s.a.ctx, { name: "Project 11" });
    await expect(updateProject(s.a.ctx, first.id, { name: "Project 1", status: "active" })).rejects.toBeInstanceOf(PlanLimitError);
    await expect(createProject(s.a.ctx, { name: "project 11", status: "completed" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("turns a won deal into one project for its client", async () => {
    const s = await setup();
    const company = await createCompany(s.sales.ctx, { name: "Clifton Dental" });
    const deal = await createDeal(s.sales.ctx, { title: "Patient portal", companyId: company.id, amount: 9000 });
    await moveDeal(s.sales.ctx, deal.id, { stageId: (await listStages(s.sales.ctx)).find((x) => x.kind === "won")!.id });
    const made = await createProjectFromDeal(s.sales.ctx, deal.id);
    expect(made.existed).toBe(false);
    expect(await createProjectFromDeal(s.sales.ctx, deal.id)).toEqual({ id: made.id, existed: true });
    const p = await getProject(s.pm.ctx, made.id);
    expect(p).toMatchObject({ name: "Patient portal", status: "planning", company: { name: "Clifton Dental" }, deal: { title: "Patient portal" } });
    // People who can't see deals don't get the deal's name.
    await addMember(s.a.org.id, "employee");
    expect((await getProject(s.a.ctx, made.id)).deal?.title).toBe("Patient portal");
    await expect(createProjectFromDeal(s.dev.ctx, deal.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createProjectFromDeal(s.sales.ctx, s.bProject.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
