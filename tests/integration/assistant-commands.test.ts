/**
 * Ant only changes things after the person confirms, only within their role,
 * and only in their own organization. Summaries show just the modules the
 * role can open.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase } from "../support/db";
import { answerQuestion, resolveProposal } from "@/server/assistant/answer";
import { createProject } from "@/server/projects/projects";
import { createTask } from "@/server/projects/tasks";
import { createLead } from "@/server/crm/leads";
import { resolveOrgContext } from "@/server/tenancy/context";

const count = async (table: string, org: string) => (await db().unsafe(`select count(*)::int as n from ${table} where organization_id = $1`, [org]))[0].n as number;

describe("Ant: actions need the person's OK", () => {
  beforeEach(resetDatabase);

  it("proposes first, changes nothing, then runs once on Confirm", async () => {
    const { org, ctx } = await createOrgWithOwner("ant-create");
    const p = await createProject(ctx, { name: "Hunza booking site" });
    const a = await answerQuestion(ctx, "create task Homepage design in Hunza booking site");
    expect(a.proposal).toMatchObject({ verb: "create", title: "Add the task Homepage design", fields: expect.arrayContaining([{ label: "Project", value: "Hunza booking site" }]) });
    expect(await count("project_task", org.id)).toBe(0);
    const done = await resolveProposal(ctx, a.proposal!.id, true);
    expect(done).toMatchObject({ done: true, text: expect.stringContaining("Homepage design") });
    const [t] = await db()`select title, project_id from project_task where organization_id = ${org.id}`;
    expect(t).toMatchObject({ title: "Homepage design", project_id: p.id });
    // Single use.
    await expect(resolveProposal(ctx, a.proposal!.id, true)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await count("project_task", org.id)).toBe(1);
  });

  it("understands a typed yes or no in Roman Urdu", async () => {
    const { org, ctx } = await createOrgWithOwner("ant-typed");
    const a = await answerQuestion(ctx, "lead banao Bilal Raza");
    expect(a.proposal).toBeTruthy();
    expect(await answerQuestion(ctx, "nahi")).toMatchObject({ text: expect.stringContaining("didn't change anything") });
    expect(await count("crm_lead", org.id)).toBe(0);
    await answerQuestion(ctx, "add vendor CloudNest Hosting");
    expect(await answerQuestion(ctx, "haan")).toMatchObject({ done: true });
    expect(await count("finance_vendor", org.id)).toBe(1);
    // With nothing waiting, "yes" doesn't do anything.
    expect((await answerQuestion(ctx, "yes")).done).toBeUndefined();
  });

  it("deletes only after confirming, and asks when a name is ambiguous", async () => {
    const { org, ctx } = await createOrgWithOwner("ant-delete");
    const p = await createProject(ctx, { name: "Site" });
    await createTask(ctx, p.id, { title: "Homepage design" });
    await createTask(ctx, p.id, { title: "Homepage copy" });
    const vague = await answerQuestion(ctx, "delete task Homepage");
    expect(vague.proposal).toBeUndefined();
    expect(vague.items?.map((i) => i.title).sort()).toEqual(["Homepage copy", "Homepage design"]);
    const a = await answerQuestion(ctx, "delete task Homepage design");
    expect(a.proposal).toMatchObject({ verb: "delete" });
    expect(await count("project_task", org.id)).toBe(2);
    await resolveProposal(ctx, a.proposal!.id, true);
    expect((await db()`select title from project_task where organization_id = ${org.id}`).map((r) => r.title)).toEqual(["Homepage copy"]);
    await createLead(ctx, { fullName: "Ali Khan" });
    const arch = await answerQuestion(ctx, "archive lead Ali Khan");
    await resolveProposal(ctx, arch.proposal!.id, false);
    expect((await db()`select archived_at from crm_lead where organization_id = ${org.id}`)[0].archived_at).toBeNull();
  });

  it("never lets someone else, or another organization, confirm a proposal", async () => {
    const a = await createOrgWithOwner("ant-victim");
    const b = await createOrgWithOwner("ant-attacker");
    const admin = await addMember(a.org.id, "admin");
    const prop = await answerQuestion(a.ctx, "create project Secret plan");
    for (const ctx of [admin.ctx, b.ctx]) await expect(resolveProposal(ctx, prop.proposal!.id, true)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await count("project", a.org.id)).toBe(0);
    expect(await count("project", b.org.id)).toBe(0);
    // Names from another organization aren't found at all.
    await createProject(a.ctx, { name: "Victim project" });
    const x = await answerQuestion(b.ctx, "archive project Victim project");
    expect(x.proposal).toBeUndefined();
    expect(x.text).toContain("couldn't find");
    // An expired proposal can't be confirmed.
    await db()`update assistant_action set expires_at = now() - interval '1 second' where id = ${prop.proposal!.id}`;
    await expect(resolveProposal(a.ctx, prop.proposal!.id, true)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("stays inside the role, also when the role changes before Confirm", async () => {
    const { org, ctx: owner } = await createOrgWithOwner("ant-role");
    const emp = await addMember(org.id, "employee");
    const denied = await answerQuestion(emp.ctx, "add vendor Sneaky Supplies");
    expect(denied).toMatchObject({ restricted: true });
    expect(denied.proposal).toBeUndefined();
    expect(await count("assistant_action", org.id)).toBe(0);
    // A sales manager proposes a lead, then loses the role before confirming.
    const sm = await addMember(org.id, "sales_manager");
    const prop = await answerQuestion(sm.ctx, "create lead Zara Ahmed zara@example.com");
    expect(prop.proposal).toBeTruthy();
    await db()`update organization_member set role_id = (select id from role where organization_id is null and key = 'employee') where id = ${sm.member.id}`;
    const now = await resolveOrgContext(sm.user.id, { id: org.id });
    await expect(resolveProposal(now, prop.proposal!.id, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await count("crm_lead", org.id)).toBe(0);
    // Employees can still log their own time.
    const t = await answerQuestion(emp.ctx, "log 1:30");
    await resolveProposal(emp.ctx, t.proposal!.id, true);
    expect((await db()`select minutes from time_entry where member_id = ${emp.member.id}`)[0].minutes).toBe(90);
    void owner;
  });
});

describe("Ant: employees and loosely typed requests", () => {
  beforeEach(resetDatabase);

  it("understands a polite, misspelt request and asks for what's missing", async () => {
    const { org, ctx } = await createOrgWithOwner("ant-emp");
    const a = await answerQuestion(ctx, "can u create employe");
    expect(a.proposal).toBeUndefined();
    expect(a.text).toContain("What's their name?");
    await answerQuestion(ctx, "create department Design");
    await answerQuestion(ctx, "yes");
    const b = await answerQuestion(ctx, "Can you please add an employee Hina Khan hina@example.com as Designer in Design?");
    expect(b.proposal?.fields).toEqual(expect.arrayContaining([{ label: "Job title", value: "Designer" }, { label: "Department", value: "Design" }]));
    expect(await count("employee", org.id)).toBe(0);
    await resolveProposal(ctx, b.proposal!.id, true);
    const [e] = await db()`select e.full_name, e.work_email, e.job_title, d.name as dept from employee e left join department d on d.id = e.department_id where e.organization_id = ${org.id}`;
    expect(e).toMatchObject({ full_name: "Hina Khan", work_email: "hina@example.com", job_title: "Designer", dept: "Design" });
    const arch = await answerQuestion(ctx, "archive employee Hina Khan");
    await resolveProposal(ctx, arch.proposal!.id, true);
    expect((await db()`select status from employee where organization_id = ${org.id}`)[0].status).toBe("archived");
    expect((await answerQuestion(ctx, "create a spaceship")).text).toContain("Create: employee");
  });

  it("doesn't let an employee add employees", async () => {
    const { org } = await createOrgWithOwner("ant-emp-role");
    const emp = await addMember(org.id, "employee");
    const a = await answerQuestion(emp.ctx, "create employee Sneaky Person");
    expect(a).toMatchObject({ restricted: true });
    expect(a.proposal).toBeUndefined();
  });
});

describe("Ant: analytics summaries", () => {
  beforeEach(resetDatabase);

  it("summarises only the modules the role can see", async () => {
    const { org, ctx: owner } = await createOrgWithOwner("ant-sum");
    const all = await answerQuestion(owner, "give me an analytics summary");
    expect(all.sections?.map((s) => s.module)).toEqual(["sales", "finance", "projects", "time", "people", "team"]);
    const sales = await addMember(org.id, "sales_manager");
    const mod = (await answerQuestion(sales.ctx, "analytics summary")).sections?.map((s) => s.module);
    expect(mod).toContain("sales");
    expect(mod).not.toContain("finance");
    expect(mod).not.toContain("team");
    const fin = await answerQuestion(sales.ctx, "finance summary");
    expect(fin).toMatchObject({ restricted: true });
    expect(fin.sections).toBeUndefined();
    const emp = await addMember(org.id, "employee");
    const e = (await answerQuestion(emp.ctx, "how is the business doing")).sections?.map((s) => s.module);
    expect(e).toEqual(["projects", "time", "people"]);
    expect((await answerQuestion(owner, "How are sales doing?")).sections?.map((s) => s.module)).toEqual(["sales"]);
  });
});
