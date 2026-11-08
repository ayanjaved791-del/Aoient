/**
 * "Invitations for you": someone who signed up without clicking their link can
 * still join, but only invitations for their own verified email, and never by
 * guessing another person's invitation id.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createOrgWithOwner, createUser, db, resetDatabase, systemRoleId } from "../support/db";
import { acceptInvitation, acceptMyInvitation, createInvitation, listMyInvitations, revokeInvitation } from "@/server/organizations/invitations";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

describe("invitations for the signed-in email", () => {
  beforeEach(resetDatabase);

  it("lists only open invitations for my own email and lets me join one", async () => {
    const a = await createOrgWithOwner("mine-a");
    const b = await createOrgWithOwner("mine-b");
    const mine = await createInvitation(a.ctx, { email: "Worker@Example.test", roleId: await systemRoleId("employee") });
    await createInvitation(b.ctx, { email: "someone.else@example.test", roleId: await systemRoleId("employee") });

    const me = await createUser({ email: "worker@example.test" });
    const list = await listMyInvitations(me);
    expect(list).toEqual([expect.objectContaining({ id: mine.id, organizationName: a.org.name, roleName: "Employee" })]);

    await expect(acceptMyInvitation(me, mine.id)).resolves.toEqual({ organizationSlug: "mine-a" });
    const [m] = await db()<{ key: string }[]>`
      select r.key from organization_member m join role r on r.id = m.role_id
      where m.organization_id = ${a.org.id} and m.user_id = ${me.id}`;
    expect(m.key).toBe("employee");
    // Joined and used up: gone from the list, and the link no longer works.
    expect(await listMyInvitations(me)).toEqual([]);
    await expect(acceptMyInvitation(me, mine.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cannot join another person's invitation by its id", async () => {
    const a = await createOrgWithOwner("mine-a");
    const theirs = await createInvitation(a.ctx, { email: "victim@example.test", roleId: await systemRoleId("admin") });
    const attacker = await createUser({ email: "attacker@example.test" });

    expect(await listMyInvitations(attacker)).toEqual([]);
    await expect(acceptMyInvitation(attacker, theirs.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(acceptMyInvitation(attacker, randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    await expect(acceptMyInvitation(attacker, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
    const [row] = await db()<{ n: number }[]>`select count(*)::int as n from organization_member where user_id = ${attacker.id}`;
    expect(row.n).toBe(0);
    // The real invitee is unaffected.
    const victim = await createUser({ email: "victim@example.test" });
    await expect(acceptMyInvitation(victim, theirs.id)).resolves.toEqual({ organizationSlug: "mine-a" });
  });

  it("shows and accepts nothing for an unverified email", async () => {
    const a = await createOrgWithOwner("mine-a");
    const inv = await createInvitation(a.ctx, { email: "fresh@example.test", roleId: await systemRoleId("employee") });
    const unverified = await createUser({ email: "fresh@example.test", verified: false });
    expect(await listMyInvitations(unverified)).toEqual([]);
    await expect(acceptMyInvitation(unverified, inv.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("hides revoked and expired invitations and ones for teams I already belong to", async () => {
    const a = await createOrgWithOwner("mine-a");
    const b = await createOrgWithOwner("mine-b");
    const c = await createOrgWithOwner("mine-c");
    const me = await createUser({ email: "me@example.test" });
    const revoked = await createInvitation(a.ctx, { email: me.email, roleId: await systemRoleId("employee") });
    await revokeInvitation(a.ctx, revoked.id);
    const expired = await createInvitation(b.ctx, { email: me.email, roleId: await systemRoleId("employee") });
    await db()`update invitation set expires_at = now() - interval '1 minute' where id = ${expired.id}`;
    const joined = await createInvitation(c.ctx, { email: me.email, roleId: await systemRoleId("employee") });
    await db()`insert into organization_member (organization_id, user_id, role_id) values (${c.org.id}, ${me.id}, ${await systemRoleId("employee")})`;

    expect(await listMyInvitations(me)).toEqual([]);
    await expect(acceptMyInvitation(me, revoked.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(acceptMyInvitation(me, expired.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(acceptMyInvitation(me, joined.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("the join link still refuses a different email with a clear message", async () => {
    const a = await createOrgWithOwner("mine-a");
    const inv = await createInvitation(a.ctx, { email: "right@example.test", roleId: await systemRoleId("employee") });
    const wrong = await createUser({ email: "wrong@example.test" });
    await expect(acceptInvitation(wrong, inv.url.split("/invite/")[1])).rejects.toBeInstanceOf(ForbiddenError);
  });
});
