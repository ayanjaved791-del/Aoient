/** Terms & Privacy must be agreed before creating a workspace or paying, and the agreement is recorded. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, db, resetDatabase, createOrgWithOwner, addMember } from "../support/db";
import { NextRequest } from "next/server";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

const session = vi.hoisted(() => ({ user: null as null | { id: string; email: string; name: string; emailVerified: boolean; image: null } }));
vi.mock("@/server/auth/session", async () => {
  const { UnauthorizedError } = await import("@/lib/errors");
  return {
    requireUser: async () => { if (!session.user) throw new UnauthorizedError(); return session.user; },
    getSessionUser: async () => session.user,
    requireUserOrRedirect: async () => session.user,
  };
});
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.hoisted(() => { process.env.PADDLE_WEBHOOK_SECRET = "pdl_ntfset_test_secret"; });

import { createOrganizationAction } from "@/modules/organization/actions";
import { startCheckoutAction } from "@/modules/billing/actions";
import { POST } from "@/app/api/v1/organizations/route";

async function signIn(name = "Terms Tester") {
  const u = await createUser({ name });
  session.user = { id: u.id, email: u.email, name: u.name, emailVerified: true, image: null };
  return u;
}
const rows = (userId: string) => db()<{ context: string; terms_version: string; privacy_version: string; organization_id: string | null }[]>`
  select context, terms_version, privacy_version, organization_id from legal_acceptance where user_id = ${userId} order by accepted_at`;

describe("terms & privacy acceptance", () => {
  beforeEach(resetDatabase);

  it("creating a first workspace requires agreeing, then records it with the workspace", async () => {
    const u = await signIn();
    const refused = await createOrganizationAction({ name: "No Terms", slug: "no-terms", timezone: "UTC", currency: "USD" });
    expect(refused).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR", fields: { acceptTerms: [expect.any(String)] } } });
    expect(await db()`select 1 from organization where slug = 'no-terms'`).toHaveLength(0);

    const created = await createOrganizationAction({ name: "Agreed", slug: "agreed-co", timezone: "UTC", currency: "USD", acceptTerms: true });
    expect(created.ok).toBe(true);
    const [r] = await rows(u.id);
    expect(r).toMatchObject({ context: "workspace", terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION });
    expect(r.organization_id).not.toBeNull();

    // Already agreed to the current version: a second workspace doesn't ask again.
    expect((await createOrganizationAction({ name: "Second", slug: "second-co", timezone: "UTC", currency: "USD" })).ok).toBe(true);
  });

  it("the REST API enforces the same rule", async () => {
    await signIn();
    const res = await POST(new NextRequest("http://localhost/api/v1/organizations", { method: "POST", body: JSON.stringify({ name: "Api Co", slug: "api-co" }), headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" } }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(422);
  });

  it("checkout hands out the signed token only after agreeing, and records it", async () => {
    const owner = await signIn("Buyer Owner");
    const { org } = await createOrgWithOwner("buy-co", owner, { license: "trial" });
    expect(await startCheckoutAction("buy-co", false)).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    const ok = await startCheckoutAction("buy-co", true);
    expect(ok).toMatchObject({ ok: true, data: { checkoutToken: expect.stringMatching(/^v1\./) } });
    expect((await rows(owner.id)).at(-1)).toMatchObject({ context: "checkout", organization_id: org.id });

    // Not allowed to buy for this workspace: no token.
    const admin = await addMember(org.id, "admin");
    session.user = { id: admin.user.id, email: admin.user.email, name: admin.user.name, emailVerified: true, image: null };
    expect(await startCheckoutAction("buy-co", true)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    // Someone outside the workspace gets the same "not found" as a missing one.
    await signIn("Outsider");
    expect(await startCheckoutAction("buy-co", true)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});
