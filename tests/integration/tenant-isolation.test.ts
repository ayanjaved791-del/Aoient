/**
 * Cross-tenant access attempts (spec §5, AT-02, AT-12). Every attempt by a member
 * of organization A against organization B must fail with the same NOT_FOUND
 * result as a non-existent record, and must leave B's data untouched.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addMember, createOrgWithOwner, createUser, db, resetDatabase } from "../support/db";
import { NotFoundError } from "@/lib/errors";
import { resolveOrgContext } from "@/server/tenancy/context";
import { getOrganization, listMembers, listUserOrganizations, removeMember, updateMember, updateOrganization } from "@/server/organizations/organizations";
import { createInvitation, listPendingInvitations, revokeInvitation } from "@/server/organizations/invitations";
import { createCustomRole, deleteCustomRole, listRoles, updateCustomRole } from "@/server/organizations/roles";

// Route-level tests swap the session for a chosen user.
const sessionUser = vi.hoisted(() => ({ current: null as null | { id: string; email: string; name: string; emailVerified: boolean; image: null } }));
vi.mock("@/server/auth/session", async () => {
  const { UnauthorizedError } = await import("@/lib/errors");
  return {
    requireUser: async () => {
      if (!sessionUser.current) throw new UnauthorizedError();
      return sessionUser.current;
    },
    getSessionUser: async () => sessionUser.current,
  };
});

async function setup() {
  await resetDatabase();
  const a = await createOrgWithOwner("org-a");
  const b = await createOrgWithOwner("org-b");
  const bEmployee = await addMember(b.org.id, "employee");
  const bRole = await createCustomRole(b.ctx, { name: "B Reviewer", permissions: ["organization.read"] });
  const bInvite = await createInvitation(b.ctx, { email: "candidate@b.test", roleId: bRole.id });
  return { a, b, bEmployee, bRole, bInvite };
}

describe("tenant isolation — service layer", () => {
  let s: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    s = await setup();
  });

  it("cannot resolve a context for an organization you do not belong to (by slug or id)", async () => {
    await expect(resolveOrgContext(s.a.user.id, { slug: "org-b" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(resolveOrgContext(s.a.user.id, { id: s.b.org.id })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns an identical error for foreign and non-existent organizations (no existence leak)", async () => {
    const foreign = await resolveOrgContext(s.a.user.id, { slug: "org-b" }).catch((e) => e);
    const missing = await resolveOrgContext(s.a.user.id, { slug: "does-not-exist" }).catch((e) => e);
    expect(foreign).toBeInstanceOf(NotFoundError);
    expect(missing).toBeInstanceOf(NotFoundError);
    expect(foreign.message).toBe(missing.message);
    expect(foreign.status).toBe(missing.status);
  });

  it("suspended members and inactive organizations lose access", async () => {
    await db()`update organization_member set status = 'suspended' where id = ${s.bEmployee.member.id}`;
    await expect(resolveOrgContext(s.bEmployee.user.id, { id: s.b.org.id })).rejects.toBeInstanceOf(NotFoundError);
    await db()`update organization set status = 'suspended' where id = ${s.a.org.id}`;
    await expect(resolveOrgContext(s.a.user.id, { id: s.a.org.id })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists only the caller's own tenant data", async () => {
    const members = await listMembers(s.a.ctx);
    expect(members.map((m) => m.userId)).toEqual([s.a.user.id]);
    expect(await listPendingInvitations(s.a.ctx)).toEqual([]);
    const roles = await listRoles(s.a.ctx);
    expect(roles.find((r) => r.id === s.bRole.id)).toBeUndefined();
    expect((await getOrganization(s.a.ctx)).id).toBe(s.a.org.id);
  });

  it("cannot modify or remove another tenant's members", async () => {
    await expect(updateMember(s.a.ctx, s.bEmployee.member.id, { status: "suspended" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeMember(s.a.ctx, s.bEmployee.member.id)).rejects.toBeInstanceOf(NotFoundError);
    const [still] = await db()<{ status: string; roleId: string }[]>`select status, role_id as "roleId" from organization_member where id = ${s.bEmployee.member.id}`;
    expect(still.status).toBe("active");
  });

  it("cannot revoke another tenant's invitation", async () => {
    await expect(revokeInvitation(s.a.ctx, s.bInvite.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await db()<{ status: string }[]>`select status from invitation where id = ${s.bInvite.id}`)[0].status).toBe("pending");
  });

  it("cannot assign, edit or delete another tenant's custom role", async () => {
    await expect(createInvitation(s.a.ctx, { email: "x@a.test", roleId: s.bRole.id })).rejects.toBeInstanceOf(NotFoundError);
    const aEmp = await addMember(s.a.org.id, "employee");
    await expect(updateMember(s.a.ctx, aEmp.member.id, { roleId: s.bRole.id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateCustomRole(s.a.ctx, s.bRole.id, { name: "Hijacked", permissions: [] })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteCustomRole(s.a.ctx, s.bRole.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await db()<{ name: string }[]>`select name from role where id = ${s.bRole.id}`)[0].name).toBe("B Reviewer");
  });

  it("a user in two organizations gets separate scopes (AT-02)", async () => {
    const shared = await createUser();
    await addMember(s.a.org.id, "employee", shared);
    await addMember(s.b.org.id, "admin", shared);
    const orgs = await listUserOrganizations(shared.id);
    expect(orgs.map((o) => o.slug).sort()).toEqual(["org-a", "org-b"]);

    const inA = await resolveOrgContext(shared.id, { slug: "org-a" });
    const inB = await resolveOrgContext(shared.id, { slug: "org-b" });
    expect(inA.roleKey).toBe("employee");
    expect(inB.roleKey).toBe("admin");
    // Admin rights in B do not carry into A.
    await expect(updateOrganization(inA, { name: "Renamed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Employees can't see the member list; B's admin list never includes A-only people.
    await expect(listMembers(inA)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const bMembers = await listMembers(inB);
    expect(bMembers.every((m) => m.userId !== s.a.user.id)).toBe(true);
  });
});

describe("tenant isolation — /api/v1 route handlers (AT-12)", () => {
  let s: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    s = await setup();
    sessionUser.current = { ...s.a.user, image: null };
  });

  const req = (method: string, body?: unknown) =>
    new Request("http://localhost:3000/api/v1/x", {
      method,
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

  it("GET/PATCH another organization → 404 with the standard envelope, data unchanged", async () => {
    const orgRoute = await import("@/app/api/v1/organizations/[id]/route");
    const get = await orgRoute.GET(req("GET"), params({ id: s.b.org.id }));
    expect(get.status).toBe(404);
    expect(await get.json()).toEqual({ error: { code: "NOT_FOUND", message: "Organization not found" } });

    const patch = await orgRoute.PATCH(req("PATCH", { name: "Pwned" }), params({ id: s.b.org.id }));
    expect(patch.status).toBe(404);
    expect((await db()<{ name: string }[]>`select name from organization where id = ${s.b.org.id}`)[0].name).toBe("Org org-b");

    const missing = await orgRoute.GET(req("GET"), params({ id: "0190a8b4-7c3e-7000-8000-000000000000" }));
    expect(missing.status).toBe(404);
  });

  it("foreign members/invitations/roles endpoints → 404", async () => {
    const members = await import("@/app/api/v1/organizations/[id]/members/route");
    const member = await import("@/app/api/v1/organizations/[id]/members/[memberId]/route");
    const invites = await import("@/app/api/v1/organizations/[id]/invitations/route");
    const roles = await import("@/app/api/v1/organizations/[id]/roles/route");

    expect((await members.GET(req("GET"), params({ id: s.b.org.id }))).status).toBe(404);
    expect((await invites.GET(req("GET"), params({ id: s.b.org.id }))).status).toBe(404);
    expect((await invites.POST(req("POST", { email: "x@x.test", roleId: s.bRole.id }), params({ id: s.b.org.id }))).status).toBe(404);
    expect((await roles.GET(req("GET"), params({ id: s.b.org.id }))).status).toBe(404);
    // Mixing own org id with a foreign member id is also rejected.
    expect((await member.DELETE(req("DELETE"), params({ id: s.a.org.id, memberId: s.bEmployee.member.id }))).status).toBe(404);
    expect((await db()`select count(*)::int as n from organization_member where organization_id = ${s.b.org.id}`)[0].n).toBe(2);
  });

  it("own organization works; unauthenticated and cross-origin requests are rejected", async () => {
    const orgRoute = await import("@/app/api/v1/organizations/[id]/route");
    const own = await orgRoute.GET(req("GET"), params({ id: s.a.org.id }));
    expect(own.status).toBe(200);
    expect((await own.json()).data.slug).toBe("org-a");

    const crossOrigin = new Request("http://localhost:3000/api/v1/x", {
      method: "PATCH", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify({ name: "x" }),
    });
    expect((await orgRoute.PATCH(crossOrigin, params({ id: s.a.org.id }))).status).toBe(403);

    sessionUser.current = null;
    const anon = await orgRoute.GET(req("GET"), params({ id: s.a.org.id }));
    expect(anon.status).toBe(401);
    expect((await anon.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("malformed IDs are treated as not found (never a server error)", async () => {
    const orgRoute = await import("@/app/api/v1/organizations/[id]/route");
    const member = await import("@/app/api/v1/organizations/[id]/members/[memberId]/route");
    const invitation = await import("@/app/api/v1/organizations/[id]/invitations/[invitationId]/route");
    const role = await import("@/app/api/v1/organizations/[id]/roles/[roleId]/route");
    expect((await orgRoute.GET(req("GET"), params({ id: "not-a-uuid" }))).status).toBe(404);
    expect((await member.DELETE(req("DELETE"), params({ id: s.a.org.id, memberId: "x' or 1=1 --" }))).status).toBe(404);
    expect((await invitation.DELETE(req("DELETE"), params({ id: s.a.org.id, invitationId: "123" }))).status).toBe(404);
    expect((await role.DELETE(req("DELETE"), params({ id: s.a.org.id, roleId: "../owner" }))).status).toBe(404);
  });
});

/**
 * The browser holds Supabase's public key, which talks to the database as the
 * `anon` / `authenticated` roles. Row Level Security with no policies must make
 * every app table invisible and read-only to them.
 */
describe("tenant isolation — Supabase Data API roles (RLS)", () => {
  beforeEach(async () => {
    await setup();
  });

  const TABLES = [
    "profile", "organization", "organization_member", "role", "permission", "role_permission",
    "invitation", "audit_log", "rate_limit_bucket", "schema_migration",
  ];

  for (const apiRole of ["anon", "authenticated"] as const) {
    it(`${apiRole} can read no rows and write nothing`, async () => {
      const sql = db();
      await sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${apiRole}`);
        for (const table of TABLES) {
          const rows = await tx.unsafe(`select * from public.${table}`);
          expect(rows.length, `${apiRole} read ${table}`).toBe(0);
        }
        await expect(
          tx.savepoint((sp) => sp`insert into organization (name, slug) values ('Evil', 'evil-org')`),
        ).rejects.toThrow(/row-level security/);
        const updated = await tx`update organization set name = 'Pwned'`;
        expect(updated.count).toBe(0);
      });
      expect((await sql<{ n: number }[]>`select count(*)::int as n from organization where name = 'Pwned' or slug = 'evil-org'`)[0].n).toBe(0);
    });
  }

  it("every table in public has row level security enabled", async () => {
    const rows = await db()<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
});
