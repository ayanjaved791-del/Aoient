/** Activating a license by reading the subscription from Paddle's API (no webhook needed). */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_PADDLE_PRICE_MEDISEA_MONTHLY = "pri_medisea_m";
  process.env.PADDLE_WEBHOOK_SECRET = "pdl_ntfset_test_secret";
});

import { addMember, createOrgWithOwner, resetDatabase } from "../support/db";
import { signCheckout } from "@/server/billing/checkout-token";
import { syncLicenseFromPaddle, syncMyLicense } from "@/server/billing/paddle-sync";
import { getLicenseOverview } from "@/server/billing/license";
import { ForbiddenError } from "@/lib/errors";

const env = { ...process.env, PADDLE_API_KEY: "pdl_sdbx_apikey_test" };
const sub = (id: string, customData: Record<string, unknown>, status = "trialing") => ({
  id, status, customer_id: "ctm_1", custom_data: customData, updated_at: new Date().toISOString(),
  items: [{ price: { id: "pri_medisea_m" }, trial_dates: { ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString() } }],
  current_billing_period: { ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString() },
});
function fakePaddle(subs: ReturnType<typeof sub>[]) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer pdl_sdbx_apikey_test");
    const one = url.match(/\/subscriptions\/(sub_\w+)/);
    if (one) {
      const s = subs.find((x) => x.id === one[1]);
      return new Response(JSON.stringify(s ? { data: s } : {}), { status: s ? 200 : 404 });
    }
    return new Response(JSON.stringify({ data: subs, meta: { pagination: { has_more: false } } }), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe("Paddle API sync", () => {
  beforeEach(resetDatabase);

  it("activates the bought plan from Paddle, by subscription id or by search", async () => {
    const a = await createOrgWithOwner("sync-a", undefined, { license: "trial" });
    const token = signCheckout(a.org.id, a.user.id);
    const paddle = fakePaddle([sub("sub_aaaaaaaaaaaa", { organizationId: a.org.id, checkoutToken: token })]);

    const r1 = await syncLicenseFromPaddle(a.org.id, { subscriptionId: "sub_aaaaaaaaaaaa", env, fetchImpl: paddle.fetchImpl });
    expect(r1).toEqual({ kind: "done", outcome: "applied" });
    const { license } = await getLicenseOverview(a.org.id);
    expect(license).toMatchObject({ plan: "medisea", source: "paddle", status: "trialing" });

    // Running again is harmless (same data).
    const r2 = await syncLicenseFromPaddle(a.org.id, { env, fetchImpl: paddle.fetchImpl });
    expect(r2.kind).toBe("done");
  });

  it("never applies a subscription bound to another organization or without a valid token", async () => {
    const a = await createOrgWithOwner("sync-a", undefined, { license: "trial" });
    const b = await createOrgWithOwner("sync-b", undefined, { license: "trial" });
    const paddle = fakePaddle([
      sub("sub_bbbbbbbbbbbb", { organizationId: b.org.id, checkoutToken: signCheckout(b.org.id, b.user.id) }),
      // Claims org A but the token was signed for B: forged custom_data.
      sub("sub_cccccccccccc", { organizationId: a.org.id, checkoutToken: signCheckout(b.org.id, b.user.id) }),
    ]);
    expect(await syncLicenseFromPaddle(a.org.id, { subscriptionId: "sub_bbbbbbbbbbbb", env, fetchImpl: paddle.fetchImpl })).toEqual({ kind: "none" });
    const forged = await syncLicenseFromPaddle(a.org.id, { env, fetchImpl: paddle.fetchImpl });
    expect(forged).toEqual({ kind: "done", outcome: "ignored_unknown_organization" });
    expect((await getLicenseOverview(a.org.id)).license).toMatchObject({ source: "trial" });
  });

  it("is honest when Paddle isn't configured, and owner-only from the app", async () => {
    const a = await createOrgWithOwner("sync-a", undefined, { license: "trial" });
    expect(await syncLicenseFromPaddle(a.org.id, { env: { ...env, PADDLE_API_KEY: undefined } })).toEqual({ kind: "not-configured" });
    const admin = await addMember(a.org.id, "admin");
    await expect(syncMyLicense(admin.ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
