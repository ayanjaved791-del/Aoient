/**
 * The assistant answers from the caller's organization only, and only within
 * their role: Owner/Admin see the whole workspace, Employee and Client/Guest
 * get their own information.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, createUser, resetDatabase, systemRoleId } from "../support/db";
import { answerQuestion } from "@/server/assistant/answer";
import { createInvitation } from "@/server/organizations/invitations";

const flat = (a: Awaited<ReturnType<typeof answerQuestion>>) => JSON.stringify(a);

describe("assistant", () => {
  beforeEach(resetDatabase);

  async function setup() {
    const a = await createOrgWithOwner("asst-a", await createUser({ name: "Owner Amina", email: "amina@a.test" }));
    const admin = await addMember(a.org.id, "admin", await createUser({ name: "Admin Bilal", email: "bilal@a.test" }));
    const employee = await addMember(a.org.id, "employee", await createUser({ name: "Employee Sana", email: "sana@a.test" }));
    const guest = await addMember(a.org.id, "guest", await createUser({ name: "Client Omar", email: "omar@a.test" }));
    await createInvitation(a.ctx, { email: "pending.person@a.test", roleId: await systemRoleId("employee") });
    const b = await createOrgWithOwner("asst-b", await createUser({ name: "Secret Zed", email: "zed@b.test" }));
    await addMember(b.org.id, "employee", await createUser({ name: "Hidden Hina", email: "hina@b.test" }));
    return { a, admin, employee, guest, b };
  }

  it("owner and admin get workspace-wide answers", async () => {
    const s = await setup();
    const count = await answerQuestion(s.a.ctx, "How many members do we have?");
    expect(count.text).toContain("4 active members");
    const admins = await answerQuestion(s.admin.ctx, "list all admins");
    expect(admins.items?.map((i) => i.title)).toEqual(["Admin Bilal"]);
    const invites = await answerQuestion(s.admin.ctx, "Which invitations are pending?");
    expect(flat(invites)).toContain("pending.person@a.test");
    const plan = await answerQuestion(s.a.ctx, "How many days are left on our plan?");
    expect(plan.restricted).toBeFalsy();
    expect(plan.text).toMatch(/Pacfic-DeepDive/);
  });

  it("employee only gets their own information", async () => {
    const s = await setup();
    for (const q of ["How many members do we have?", "list all admins", "Who is Bilal?", "Which invitations are pending?", "How many days are left on our plan?", "give me a summary", "Who is most active this month?"]) {
      const a = await answerQuestion(s.employee.ctx, q);
      expect(a.restricted, q).toBe(true);
      expect(flat(a), q).not.toMatch(/Bilal|Amina|Omar|pending\.person|Pacfic/);
    }
    const me = await answerQuestion(s.employee.ctx, "What is my role?");
    expect(me.text).toContain("Employee");
    expect(flat(me)).toContain("sana@a.test");
    // "Activity" falls back to the person's own actions only.
    const act = await answerQuestion(s.employee.ctx, "what happened today");
    expect(act.restricted).toBe(true);
    expect(flat(act)).not.toMatch(/Amina|invited/);
  });

  it("client / guest only gets their own information", async () => {
    const s = await setup();
    const who = await answerQuestion(s.guest.ctx, "who is sana@a.test");
    expect(who.restricted).toBe(true);
    expect(flat(who)).not.toContain("Employee Sana");
    const perms = await answerQuestion(s.guest.ctx, "What can I do here?");
    expect(perms.text).toContain("Client / Guest");
    expect(perms.items ?? []).toHaveLength(0);
  });

  it("never reveals another organization's data", async () => {
    const s = await setup();
    for (const q of ["Who is Hina?", "list all members", "What happened this month?", "Who joined recently?"]) {
      expect(flat(await answerQuestion(s.a.ctx, q)), q).not.toMatch(/Hina|Zed|b\.test|asst-b/);
    }
    // Looking up someone from another workspace finds nothing (the reply only echoes the question).
    const other = await answerQuestion(s.a.ctx, "who is zed@b.test");
    expect(other.items ?? []).toHaveLength(0);
    expect(other.text).toMatch(/^No member matches/);
  });
});
