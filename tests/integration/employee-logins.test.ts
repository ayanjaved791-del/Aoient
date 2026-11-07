/** Logins an admin creates for employees: who may do it, what is stored, and who may reset them. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, createUser, db, resetDatabase, systemRoleId } from "../support/db";
import { ConflictError, ForbiddenError, PlanLimitError } from "@/lib/errors";
import { createEmployee } from "@/server/people/employees";
import { createEmployeeLogin, getEmployeeLogin, resetEmployeePassword } from "@/server/people/accounts";
import { markPasswordChanged } from "@/server/account/account";
import { setLicense } from "../support/db";

const env = { NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-role-test" };
/** Stand-in for Supabase's admin API, writing to the test auth.users table so the profile trigger runs. */
function fakeAdmin() {
  const calls: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const path = url.replace("http://supabase.test/auth/v1", "");
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ method: init?.method ?? "GET", path, body });
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer service-role-test");
    if (init?.method === "POST") {
      const [exists] = await db()`select 1 from auth.users where lower(email) = lower(${String(body!.email)})`;
      if (exists) return new Response(JSON.stringify({ error_code: "email_exists" }), { status: 422 });
      const [u] = await db()<{ id: string }[]>`
        insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values (${String(body!.email)}, ${db().json(body!.user_metadata as never)}, now()) returning id`;
      return new Response(JSON.stringify({ id: u.id }), { status: 200 });
    }
    if (init?.method === "DELETE") { await db()`delete from auth.users where id = ${path.split("/").pop()!}`; return new Response("{}", { status: 200 }); }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { calls, opts: { env, fetchImpl } };
}

describe("employee logins", () => {
  beforeEach(resetDatabase);

  async function setup() {
    const a = await createOrgWithOwner("logins-a");
    const emp = await createEmployee(a.ctx, { fullName: "Nadia Noor", workEmail: "nadia@a.test" });
    return { a, emp, employeeRole: await systemRoleId("employee") };
  }

  it("creates a confirmed login with a temporary password, links it, and never stores the password", async () => {
    const s = await setup();
    const admin = fakeAdmin();
    await createEmployeeLogin(s.a.ctx, s.emp.id, { email: "Nadia@a.test", password: "TempPass12345", roleId: s.employeeRole }, admin.opts);
    expect(admin.calls[0]).toMatchObject({ method: "POST", path: "/admin/users", body: { email: "nadia@a.test", email_confirm: true, user_metadata: { name: "Nadia Noor" } } });

    const login = await getEmployeeLogin(s.a.ctx, s.emp.id);
    expect(login).toMatchObject({ email: "nadia@a.test", roleName: "Employee", mustChangePassword: true, canResetPassword: true });
    const audit = await db()`select metadata from audit_log where action = 'member.login_created'`;
    expect(JSON.stringify(audit)).not.toContain("TempPass12345");
    expect(JSON.stringify(await db()`select * from profile where email = 'nadia@a.test'`)).not.toContain("TempPass12345");

    // After they choose their own password, admins see that (but never the password).
    const [{ user_id }] = await db()<{ user_id: string }[]>`select m.user_id from employee e join organization_member m on m.id = e.member_id where e.id = ${s.emp.id}`;
    await markPasswordChanged(user_id);
    expect(await getEmployeeLogin(s.a.ctx, s.emp.id)).toMatchObject({ mustChangePassword: false, passwordChangedAt: expect.any(Date) });
  });

  it("only roles that can invite and edit people may create logins, within seat limits", async () => {
    const s = await setup();
    const hr = await addMember(s.a.org.id, "hr_manager"); // edits people but can't invite members
    await expect(createEmployeeLogin(hr.ctx, s.emp.id, { email: "x@a.test", password: "TempPass12345", roleId: s.employeeRole }, fakeAdmin().opts)).rejects.toBeInstanceOf(ForbiddenError);
    // Admins can't hand out the Owner role.
    const adminMember = await addMember(s.a.org.id, "admin");
    await expect(createEmployeeLogin(adminMember.ctx, s.emp.id, { email: "x@a.test", password: "TempPass12345", roleId: await systemRoleId("owner") }, fakeAdmin().opts)).rejects.toBeInstanceOf(ForbiddenError);
    // Existing accounts are never taken over: invite them instead.
    await createUser({ email: "taken@a.test" });
    await expect(createEmployeeLogin(s.a.ctx, s.emp.id, { email: "taken@a.test", password: "TempPass12345", roleId: s.employeeRole }, fakeAdmin().opts)).rejects.toBeInstanceOf(ConflictError);
    // Seat limits apply (Medisea: 5 users).
    await setLicense(s.a.org.id, { plan: "medisea", status: "active" });
    for (let i = 0; i < 2; i++) await addMember(s.a.org.id, "employee");
    await expect(createEmployeeLogin(s.a.ctx, s.emp.id, { email: "seat@a.test", password: "TempPass12345", roleId: s.employeeRole }, fakeAdmin().opts)).rejects.toBeInstanceOf(PlanLimitError);
    expect(await db()`select 1 from auth.users where email = 'seat@a.test'`).toHaveLength(0); // nothing created
  });

  it("temporary passwords can only be set for this workspace's own logins, and not for people in other workspaces", async () => {
    const s = await setup();
    const admin = fakeAdmin();
    await createEmployeeLogin(s.a.ctx, s.emp.id, { email: "nadia@a.test", password: "TempPass12345", roleId: s.employeeRole }, admin.opts);
    await resetEmployeePassword(s.a.ctx, s.emp.id, { password: "AnotherTemp123" }, admin.opts);
    expect(admin.calls.at(-1)).toMatchObject({ method: "PUT", body: { password: "AnotherTemp123" } });

    // Another organization can't reach this employee at all.
    const b = await createOrgWithOwner("logins-b");
    await expect(resetEmployeePassword(b.ctx, s.emp.id, { password: "HijackPass123" }, admin.opts)).rejects.toThrow();

    // Once Nadia also joins another workspace, her account is hers: no more admin resets.
    const [{ user_id }] = await db()<{ user_id: string }[]>`select m.user_id from employee e join organization_member m on m.id = e.member_id where e.id = ${s.emp.id}`;
    await db()`insert into organization_member (organization_id, user_id, role_id) values (${b.org.id}, ${user_id}, ${s.employeeRole})`;
    await expect(resetEmployeePassword(s.a.ctx, s.emp.id, { password: "AnotherTemp456" }, admin.opts)).rejects.toBeInstanceOf(ForbiddenError);

    // Linking an existing account (not created here) never allows resets either.
    const other = await createUser({ email: "own@a.test" });
    const m = await addMember(s.a.org.id, "employee", other);
    const linked = await createEmployee(s.a.ctx, { fullName: "Own Account", memberId: m.member.id });
    expect((await getEmployeeLogin(s.a.ctx, linked.id))?.canResetPassword).toBe(false);
  });

  it("says clearly when the service role key isn't configured", async () => {
    const s = await setup();
    await expect(createEmployeeLogin(s.a.ctx, s.emp.id, { email: "n@a.test", password: "TempPass12345", roleId: s.employeeRole }, { env: { NEXT_PUBLIC_SUPABASE_URL: "http://x" } }))
      .rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe("account changes flow to the employee record", () => {
  beforeEach(resetDatabase);
  it("renaming yourself or changing your sign-in email updates linked People records", async () => {
    const a = await createOrgWithOwner("sync-a");
    const u = await createUser({ name: "Old Name", email: "old@a.test" });
    const m = await addMember(a.org.id, "employee", u);
    const emp = await createEmployee(a.ctx, { fullName: "Old Name", workEmail: "old@a.test", memberId: m.member.id });
    const other = await createEmployee(a.ctx, { fullName: "Someone Else", workEmail: "else@a.test" });
    await db()`update auth.users set raw_user_meta_data = ${db().json({ name: "New Name" })}, email = 'new@a.test' where id = ${u.id}`;
    const [row] = await db()<{ full_name: string; work_email: string }[]>`select full_name, work_email from employee where id = ${emp.id}`;
    expect(row).toEqual({ full_name: "New Name", work_email: "new@a.test" });
    const [untouched] = await db()<{ full_name: string }[]>`select full_name from employee where id = ${other.id}`;
    expect(untouched.full_name).toBe("Someone Else");
  });
});
