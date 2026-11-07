/** Shareable invite links: shown once to the inviter, renewable, scoped to one organization. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, createUser, db, resetDatabase, systemRoleId } from "../support/db";
import { acceptInvitation, createInvitation, getInvitationPreview, renewInvitation } from "@/server/organizations/invitations";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { hashToken } from "@/lib/tokens";

const tokenOf = (url: string) => url.split("/invite/")[1];

describe("invite links", () => {
  beforeEach(resetDatabase);

  it("returns a working join link with the email, role and expiry, storing only its hash", async () => {
    const a = await createOrgWithOwner("links-a");
    const res = await createInvitation(a.ctx, { email: "Join.Me@Example.test", roleId: await systemRoleId("employee") });
    expect(res).toMatchObject({ email: "join.me@example.test", roleName: "Employee", delivered: false });
    expect(res.url).toMatch(/^https?:\/\/[^/]+\/invite\/[A-Za-z0-9_-]{40,}$/);
    expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6.9 * 86_400_000);

    const [row] = await db()<{ token_hash: string }[]>`select token_hash from invitation where id = ${res.id}`;
    expect(row.token_hash).toBe(hashToken(tokenOf(res.url)));

    const invitee = await createUser({ email: "join.me@example.test" });
    await expect(acceptInvitation(invitee, tokenOf(res.url))).resolves.toEqual({ organizationSlug: "links-a" });
  });

  it("a new link replaces the old one, keeping email and role", async () => {
    const a = await createOrgWithOwner("links-a");
    const first = await createInvitation(a.ctx, { email: "x@example.test", roleId: await systemRoleId("project_manager") });
    const second = await renewInvitation(a.ctx, first.id);
    expect(second).toMatchObject({ email: "x@example.test", roleName: first.roleName });
    expect(second.url).not.toBe(first.url);
    expect(await getInvitationPreview(tokenOf(first.url))).toEqual({ state: "invalid" });
    expect(await getInvitationPreview(tokenOf(second.url))).toMatchObject({ state: "valid", email: "x@example.test" });
  });

  it("cannot renew another organization's invitation, or without invite permission", async () => {
    const a = await createOrgWithOwner("links-a");
    const b = await createOrgWithOwner("links-b");
    const bInvite = await createInvitation(b.ctx, { email: "b@example.test", roleId: await systemRoleId("employee") });
    await expect(renewInvitation(a.ctx, bInvite.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(renewInvitation(a.ctx, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
    // B's link still works: A's attempt changed nothing.
    expect(await getInvitationPreview(tokenOf(bInvite.url))).toMatchObject({ state: "valid" });

    const employee = await addMember(a.org.id, "employee");
    const aInvite = await createInvitation(a.ctx, { email: "a@example.test", roleId: await systemRoleId("employee") });
    await expect(renewInvitation(employee.ctx, aInvite.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
