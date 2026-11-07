/** Live refresh: the fingerprint follows this organization's changes only, and the endpoint checks membership. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addMember, createOrgWithOwner, createUser, resetDatabase, type TestUser } from "../support/db";
import { getLiveFingerprint } from "@/server/live/fingerprint";
import { createEmployee, updateEmployee } from "@/server/people/employees";
import { createDepartment } from "@/server/people/departments";
import { createInvitation } from "@/server/organizations/invitations";

const sessionUser = vi.hoisted(() => ({ current: null as null | TestUser }));
vi.mock("@/server/auth/session", () => ({ getSessionUser: async () => sessionUser.current }));

const call = async (slug: string) => {
  const { GET } = await import("@/app/[organizationSlug]/live/route");
  return GET(new Request(`http://localhost/${slug}/live`), { params: Promise.resolve({ organizationSlug: slug }) });
};

describe("live sync", () => {
  beforeEach(async () => {
    await resetDatabase();
    sessionUser.current = null;
  });

  it("changes when this organization's data changes, and not for another organization's", async () => {
    const a = await createOrgWithOwner("live-a");
    const b = await createOrgWithOwner("live-b");
    const v0 = await getLiveFingerprint(a.ctx);
    expect(await getLiveFingerprint(a.ctx)).toBe(v0);

    await createDepartment(b.ctx, { name: "B only" });
    await createEmployee(b.ctx, { fullName: "B person" });
    expect(await getLiveFingerprint(a.ctx)).toBe(v0);

    const emp = await createEmployee(a.ctx, { fullName: "A person" });
    const v1 = await getLiveFingerprint(a.ctx);
    expect(v1).not.toBe(v0);
    await updateEmployee(a.ctx, emp.id, { fullName: "A person", jobTitle: "Nurse" });
    const v2 = await getLiveFingerprint(a.ctx);
    expect(v2).not.toBe(v1);
    await createInvitation(a.ctx, { email: "new@a.test", roleId: (await addMember(a.org.id, "employee")).member.roleId });
    expect(await getLiveFingerprint(a.ctx)).not.toBe(v2);
  });

  it("the endpoint answers members only", async () => {
    const a = await createOrgWithOwner("live-a");
    await createOrgWithOwner("live-b");
    expect((await call("live-a")).status).toBe(401);

    sessionUser.current = a.user;
    const ok = await call("live-a");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(await ok.json()).toMatchObject({ v: expect.any(String), build: expect.any(String) });

    // A member of A asking about B gets the same answer as a workspace that doesn't exist.
    expect((await call("live-b")).status).toBe(404);
    expect((await call("no-such-org")).status).toBe(404);
    sessionUser.current = await createUser();
    expect((await call("live-a")).status).toBe(404);
  });
});
