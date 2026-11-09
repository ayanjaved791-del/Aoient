/**
 * Sign-up when Supabase can't send the confirmation email: the server creates
 * the login, but the email stays unproven, so it never unlocks invitations by
 * email alone (another organization's data).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createOrgWithOwner, createUser, db, resetDatabase, systemRoleId } from "../support/db";
import { signUpWithoutEmail } from "@/server/auth/self-signup";
import { createOrganization } from "@/server/organizations/organizations";
import { acceptInvitation, acceptMyInvitation, createInvitation, listMyInvitations } from "@/server/organizations/invitations";
import { explainSignInFailure } from "@/server/auth/account-lookup";

const ENV = { SUPABASE_SERVICE_ROLE_KEY: "test-service-key", NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test" };

/** Stands in for the Supabase admin API on top of the test auth schema. */
function fakeAuthAdmin(calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push(`${init?.method} ${url.replace("http://supabase.test/auth/v1", "")}`);
    const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/admin/users") && init?.method === "POST") {
      const [exists] = await db()`select id from auth.users where lower(email) = lower(${body.email})`;
      if (exists) return json(422, { error_code: "email_exists" });
      const [u] = await db()<{ id: string }[]>`
        insert into auth.users (email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
        values (${body.email}, ${db().json(body.user_metadata)}, ${db().json(body.app_metadata)}, now()) returning id`;
      return json(200, { id: u.id });
    }
    const put = url.match(/\/admin\/users\/([0-9a-f-]+)$/);
    if (put && init?.method === "PUT") {
      await db()`update auth.users set raw_app_meta_data = ${db().json(body.app_metadata)}, email_confirmed_at = now() where id = ${put[1]}`;
      return json(200, { id: put[1] });
    }
    if (url.endsWith("/admin/generate_link")) return json(200, { hashed_token: "hash-for-" + body.email });
    return json(404, {});
  }) as typeof fetch;
}

const tokenOf = (url: string) => decodeURIComponent(url.split("/").pop()!.split("?")[0]);
const values = (email: string) => ({ name: "New Person", email, password: "a-long-password-1", confirmPassword: "a-long-password-1" });

describe("sign-up without a confirmation email", () => {
  beforeEach(resetDatabase);

  it("creates a login with an unproven email that can start its own workspace", async () => {
    const res = await signUpWithoutEmail(values("New.Person@Example.test"), { clientKey: "1.1.1.1", env: ENV, fetchImpl: fakeAuthAdmin() });
    expect(res).toEqual({ email: "new.person@example.test", tokenHash: "hash-for-new.person@example.test" });
    const [p] = await db()<{ id: string; name: string; email_verified: boolean; email_unproven: boolean }[]>`
      select id, name, email_verified, email_unproven from profile where email = 'new.person@example.test'`;
    expect(p).toMatchObject({ name: "New Person", email_verified: false, email_unproven: true });
    // Signing in with a wrong password is explained as that, not "check your inbox".
    expect(await explainSignInFailure("new.person@example.test", "1.1.1.1")).toBe("wrong-password");
    const org = await createOrganization({ id: p.id, emailVerified: false, emailUnproven: true }, { name: "Mine", slug: "mine" });
    expect(org.slug).toBe("mine");
  });

  it("never shows or accepts another organization's invitation by email alone", async () => {
    const a = await createOrgWithOwner("victim-co");
    const inv = await createInvitation(a.ctx, { email: "boss@victim.test", roleId: await systemRoleId("admin") });
    // Someone registers the invitee's address without owning the inbox.
    await signUpWithoutEmail(values("boss@victim.test"), { clientKey: "2.2.2.2", env: ENV, fetchImpl: fakeAuthAdmin() });
    const [p] = await db()<{ id: string }[]>`select id from profile where email = 'boss@victim.test'`;
    const squatter = { id: p.id, email: "boss@victim.test", emailVerified: false, emailUnproven: true };
    expect(await listMyInvitations(squatter)).toEqual([]);
    await expect(acceptMyInvitation(squatter, inv.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const [n] = await db()<{ n: number }[]>`select count(*)::int as n from organization_member where user_id = ${p.id}`;
    expect(n.n).toBe(0);
  });

  it("lets an unproven login use a join link sent to its own email, and only that", async () => {
    const a = await createOrgWithOwner("team-co");
    const mine = await createInvitation(a.ctx, { email: "joiner@example.test", roleId: await systemRoleId("employee") });
    const other = await createInvitation(a.ctx, { email: "someone@example.test", roleId: await systemRoleId("employee") });
    await signUpWithoutEmail(values("joiner@example.test"), { clientKey: "3.3.3.3", env: ENV, fetchImpl: fakeAuthAdmin() });
    const [p] = await db()<{ id: string }[]>`select id from profile where email = 'joiner@example.test'`;
    const me = { id: p.id, email: "joiner@example.test", emailVerified: false, emailUnproven: true };
    await expect(acceptInvitation(me, tokenOf(other.url))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(acceptInvitation(me, tokenOf(mine.url))).resolves.toEqual({ organizationSlug: "team-co" });
  });

  it("refuses an email that already has a real account", async () => {
    await createUser({ email: "taken@example.test" });
    await expect(signUpWithoutEmail(values("taken@example.test"), { clientKey: "4.4.4.4", env: ENV, fetchImpl: fakeAuthAdmin() }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    // An old, unconfirmed sign-up that belongs to an organization isn't taken over either.
    const stuck = await createUser({ email: "member@example.test", verified: false });
    const org = await createOrgWithOwner("has-member");
    await db()`insert into organization_member (organization_id, user_id, role_id) values (${org.org.id}, ${stuck.id}, ${await systemRoleId("employee")})`;
    await expect(signUpWithoutEmail(values("member@example.test"), { clientKey: "4.4.4.4", env: ENV, fetchImpl: fakeAuthAdmin() }))
      .rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("finishes a fresh sign-up Supabase started but couldn't email", async () => {
    const stuck = await createUser({ email: "half@example.test", verified: false });
    const calls: string[] = [];
    await signUpWithoutEmail(values("half@example.test"), { clientKey: "5.5.5.5", env: ENV, fetchImpl: fakeAuthAdmin(calls) });
    expect(calls).toContain(`PUT /admin/users/${stuck.id}`);
    const [p] = await db()`select email_verified, email_unproven from profile where id = ${stuck.id}`;
    expect(p).toMatchObject({ email_verified: false, email_unproven: true });
  });

  it("explains missing configuration and checks the bot check itself", async () => {
    await expect(signUpWithoutEmail(values("x@example.test"), { clientKey: "6.6.6.6", env: {}, fetchImpl: fakeAuthAdmin() }))
      .rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("SUPABASE_SERVICE_ROLE_KEY") });
    const captchaOn = { ...ENV, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site" };
    await expect(signUpWithoutEmail(values("x@example.test"), { clientKey: "6.6.6.6", env: captchaOn, fetchImpl: fakeAuthAdmin() }))
      .rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("TURNSTILE_SECRET_KEY") });
    const failing = (async (u: RequestInfo | URL, i?: RequestInit) =>
      String(u).includes("turnstile") ? new Response(JSON.stringify({ success: false })) : fakeAuthAdmin()(u, i)) as typeof fetch;
    await expect(signUpWithoutEmail(values("x@example.test"), { clientKey: "7.7.7.7", env: { ...captchaOn, TURNSTILE_SECRET_KEY: "s" }, captchaToken: "t", fetchImpl: failing }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    const [row] = await db()<{ n: number }[]>`select count(*)::int as n from auth.users where email = 'x@example.test'`;
    expect(row.n).toBe(0);
  });

  it("limits how many accounts one address can create", async () => {
    const f = fakeAuthAdmin();
    for (let i = 0; i < 5; i++) await signUpWithoutEmail(values(`n${i}@example.test`), { clientKey: "8.8.8.8", env: ENV, fetchImpl: f });
    await expect(signUpWithoutEmail(values("n6@example.test"), { clientKey: "8.8.8.8", env: ENV, fetchImpl: f })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
