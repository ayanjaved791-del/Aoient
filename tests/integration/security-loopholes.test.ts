/** Regression tests for loopholes found in the security review. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase, systemRoleId } from "../support/db";
import { ForbiddenError } from "@/lib/errors";
import { createEmployee, getEmployee, setEmployeeArchived, updateEmployee } from "@/server/people/employees";
import { createEmployeeLogin } from "@/server/people/accounts";
import { requestLeave } from "@/server/people/leave";
import { createCustomRole } from "@/server/organizations/roles";
import { revokeTemporaryPassword } from "@/server/auth/claim";

const env = { NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-role-test" };
function recorder() {
  const calls: { method: string; path: string }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", path: url.replace("http://supabase.test/auth/v1", "") });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { calls, opts: { env, fetchImpl } };
}
const weekday = () => {
  const d = new Date(Date.now() + 10 * 86_400_000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

describe("security loopholes", () => {
  beforeEach(resetDatabase);

  it("an editor without private-data access can't link their own account to a colleague's record to read it", async () => {
    const a = await createOrgWithOwner("sec-a");
    const ceo = await createEmployee(a.ctx, { fullName: "Chief Chandni", salaryAmount: 99000, salaryCurrency: "USD", salaryPeriod: "monthly" });
    const role = await createCustomRole(a.ctx, { name: "Records clerk", permissions: ["people.employee.read", "people.employee.create", "people.employee.update", "organization.members.invite"] });
    const clerk = await addMember(a.org.id, role.id);

    await expect(updateEmployee(clerk.ctx, ceo.id, { fullName: "Chief Chandni", memberId: clerk.member.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createEmployee(clerk.ctx, { fullName: "Copy", memberId: clerk.member.id })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await getEmployee(clerk.ctx, ceo.id)).sensitive).toBeNull();
    // Nor create a login (an account they'd control) attached to that record.
    const admin = recorder();
    await expect(createEmployeeLogin(clerk.ctx, ceo.id, { email: "mine@evil.test", password: "TempPass12345", roleId: await systemRoleId("employee") }, admin.opts))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(admin.calls).toHaveLength(0);
    // Ordinary edits that don't touch the link still work.
    await updateEmployee(clerk.ctx, ceo.id, { fullName: "Chief Chandni", jobTitle: "CEO" });
    expect((await getEmployee(a.ctx, ceo.id)).jobTitle).toBe("CEO");
  });

  it("archived employees can't request leave", async () => {
    const a = await createOrgWithOwner("sec-a");
    const worker = await addMember(a.org.id, "employee");
    const rec = await createEmployee(a.ctx, { fullName: "Gone Ghazal", memberId: worker.member.id });
    await setEmployeeArchived(a.ctx, rec.id, true);
    const day = weekday();
    await expect(requestLeave(worker.ctx, { type: "annual", startDate: day, endDate: day })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("signing in with Google retires a temporary password an admin set", async () => {
    const a = await createOrgWithOwner("sec-a");
    const worker = await addMember(a.org.id, "employee");
    await db()`update profile set must_change_password = true, managed_by_organization_id = ${a.org.id} where id = ${worker.user.id}`;
    const admin = recorder();
    expect(await revokeTemporaryPassword(worker.user.id, admin.opts)).toBe(true);
    expect(admin.calls).toEqual([{ method: "PUT", path: `/admin/users/${worker.user.id}` }]);
    const [p] = await db()<{ must_change_password: boolean }[]>`select must_change_password from profile where id = ${worker.user.id}`;
    expect(p.must_change_password).toBe(false);

    // Accounts people own already aren't touched.
    const again = recorder();
    expect(await revokeTemporaryPassword(a.user.id, again.opts)).toBe(true);
    expect(again.calls).toHaveLength(0);

    // If the password can't be replaced, sign-in is refused (caller signs them out).
    await db()`update profile set must_change_password = true, managed_by_organization_id = ${a.org.id} where id = ${worker.user.id}`;
    const failing = { env, fetchImpl: (async () => new Response("{}", { status: 500 })) as typeof fetch };
    expect(await revokeTemporaryPassword(worker.user.id, failing)).toBe(false);
  });
});
