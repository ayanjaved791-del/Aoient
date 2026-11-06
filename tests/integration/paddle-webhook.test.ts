import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Price IDs and the webhook secret are read when the modules load.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_PADDLE_PRICE_MEDISEA_MONTHLY = "pri_medisea_m";
  process.env.NEXT_PUBLIC_PADDLE_PRICE_INDIANA_MONTHLY = "pri_indiana_m";
  process.env.NEXT_PUBLIC_PADDLE_PRICE_INDIANA_ANNUAL = "pri_indiana_y";
  process.env.PADDLE_WEBHOOK_SECRET = "pdl_ntfset_test_secret";
});

import { NextRequest } from "next/server";
import { createOrgWithOwner, createUser, db, resetDatabase } from "../support/db";
import { POST } from "@/app/api/webhooks/paddle/route";
import { verifyPaddleSignature } from "@/server/billing/paddle-webhook";
import { signCheckout, verifyCheckout } from "@/server/billing/checkout-token";
import { getLicenseOverview } from "@/server/billing/license";

const SECRET = "pdl_ntfset_test_secret";
const DAY = 86_400_000;
let seq = 0;

function sign(body: string, ts = Math.floor(Date.now() / 1000), secret = SECRET) {
  return `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`;
}

function subscriptionEvent(opts: {
  type?: string;
  subId?: string;
  status?: string;
  priceId?: string;
  customData?: Record<string, unknown> | null;
  occurredAt?: Date;
  eventId?: string;
  periodEndsAt?: Date;
  canceledAt?: Date;
}) {
  return {
    event_id: opts.eventId ?? `evt_${++seq}`,
    event_type: opts.type ?? "subscription.created",
    occurred_at: (opts.occurredAt ?? new Date()).toISOString(),
    data: {
      id: opts.subId ?? "sub_01test",
      status: opts.status ?? "active",
      customer_id: "ctm_01test",
      custom_data: opts.customData === undefined ? null : opts.customData,
      items: [{ price: { id: opts.priceId ?? "pri_indiana_m" }, trial_dates: null }],
      current_billing_period: { ends_at: (opts.periodEndsAt ?? new Date(Date.now() + 30 * DAY)).toISOString() },
      canceled_at: opts.canceledAt?.toISOString() ?? null,
    },
  };
}

async function deliver(event: unknown, signature?: string) {
  const body = JSON.stringify(event);
  const res = await POST(
    new NextRequest("http://localhost/api/webhooks/paddle", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "paddle-signature": signature ?? sign(body) },
    }),
  );
  return { status: res.status, json: (await res.json()) as { outcome?: string } };
}

describe("Paddle webhook signature", () => {
  const body = '{"event_id":"evt_1"}';
  it("accepts Paddle's signature and rejects anything else", () => {
    expect(verifyPaddleSignature(body, sign(body), SECRET)).toBe(true);
    expect(verifyPaddleSignature(body + " ", sign(body), SECRET)).toBe(false); // tampered body
    expect(verifyPaddleSignature(body, sign(body, undefined, "other"), SECRET)).toBe(false); // wrong secret
    expect(verifyPaddleSignature(body, sign(body, Math.floor(Date.now() / 1000) - 600), SECRET)).toBe(false); // replayed later
    expect(verifyPaddleSignature(body, null, SECRET)).toBe(false);
    expect(verifyPaddleSignature(body, "ts=abc;h1=00", SECRET)).toBe(false);
    // During secret rotation Paddle sends several signatures; one valid is enough.
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyPaddleSignature(body, `ts=${ts};h1=deadbeef;${sign(body, ts).split(";")[1]}`, SECRET)).toBe(true);
  });

  it("checkout tokens are bound to one organization", () => {
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    const token = signCheckout(a, "user-1")!;
    expect(verifyCheckout(a, token)).toBe("user-1");
    expect(verifyCheckout(b, token)).toBeNull();
    expect(verifyCheckout(a, token.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBeNull();
    expect(verifyCheckout(a, undefined)).toBeNull();
  });
});

describe("Paddle webhook → license", () => {
  beforeEach(resetDatabase);

  async function trialOrg(slug: string) {
    const s = await createOrgWithOwner(slug, undefined, { license: "trial" });
    return { ...s, customData: { organizationId: s.org.id, checkoutToken: signCheckout(s.org.id, s.user.id) } };
  }

  it("a signed subscription event activates the paid plan, once, with an audit entry", async () => {
    const a = await trialOrg("buyer");
    const event = subscriptionEvent({ customData: a.customData });
    expect(await deliver(event)).toEqual({ status: 200, json: { received: true, outcome: "applied" } });

    const { license } = await getLicenseOverview(a.org.id);
    expect(license).toMatchObject({ plan: "indiana", billingInterval: "monthly", status: "active", source: "paddle", state: "active" });
    const [audit] = await db()`select source, action from audit_log where organization_id = ${a.org.id} and action = 'billing.license_updated'`;
    expect(audit).toMatchObject({ source: "webhook" });

    // Paddle retries the same event: nothing is applied twice.
    expect((await deliver(event)).json.outcome).toBe("duplicate");
    expect((await db()`select count(*)::int as n from audit_log where action = 'billing.license_updated'`)[0].n).toBe(1);
  });

  it("rejects unsigned or forged requests without touching any license", async () => {
    const a = await trialOrg("target");
    const event = subscriptionEvent({ customData: a.customData });
    expect((await deliver(event, "ts=1;h1=forged")).status).toBe(401);
    expect((await deliver(event, sign(JSON.stringify(event), undefined, "attacker-secret"))).status).toBe(401);
    expect((await getLicenseOverview(a.org.id)).license?.source).toBe("trial");
  });

  it("cross-tenant: a checkout token for one organization can't upgrade or overwrite another", async () => {
    const a = await trialOrg("tenant-a");
    const b = await trialOrg("tenant-b");
    // Token signed for A, organizationId swapped to B.
    const forged = subscriptionEvent({ customData: { organizationId: b.org.id, checkoutToken: a.customData.checkoutToken } });
    expect((await deliver(forged)).json.outcome).toBe("ignored_unknown_organization");
    // No token at all.
    expect((await deliver(subscriptionEvent({ subId: "sub_x", customData: { organizationId: b.org.id } }))).json.outcome).toBe(
      "ignored_unknown_organization",
    );
    expect((await getLicenseOverview(b.org.id)).license).toMatchObject({ source: "trial", plan: "medisea" });
    expect((await getLicenseOverview(a.org.id)).license).toMatchObject({ source: "trial", plan: "medisea" });
  });

  it("follows the subscription through updates, ignores stale events, and expires after cancellation", async () => {
    const a = await trialOrg("lifecycle");
    const t0 = new Date(Date.now() - 10 * 60_000);
    await deliver(subscriptionEvent({ customData: a.customData, occurredAt: t0 }));

    // Later events don't carry our custom data; the known subscription ID maps them.
    await deliver(subscriptionEvent({ type: "subscription.updated", priceId: "pri_indiana_y", occurredAt: new Date(t0.getTime() + 60_000) }));
    expect((await getLicenseOverview(a.org.id)).license).toMatchObject({ plan: "indiana", billingInterval: "yearly" });

    // An older event arriving late is ignored.
    const stale = await deliver(subscriptionEvent({ type: "subscription.updated", priceId: "pri_medisea_m", occurredAt: new Date(t0.getTime() + 30_000) }));
    expect(stale.json.outcome).toBe("ignored_stale");
    expect((await getLicenseOverview(a.org.id)).license?.plan).toBe("indiana");

    await deliver(subscriptionEvent({ type: "subscription.past_due", status: "past_due", priceId: "pri_indiana_y", occurredAt: new Date(t0.getTime() + 120_000) }));
    expect((await getLicenseOverview(a.org.id)).license?.state).toBe("past_due");

    await deliver(
      subscriptionEvent({
        type: "subscription.canceled", status: "canceled", priceId: "pri_indiana_y",
        occurredAt: new Date(t0.getTime() + 180_000), canceledAt: new Date(Date.now() - 1000),
      }),
    );
    expect((await getLicenseOverview(a.org.id)).license?.state).toBe("expired");
  });

  it("ignores unknown prices and won't let a second subscription replace a live one", async () => {
    const a = await trialOrg("double");
    expect((await deliver(subscriptionEvent({ customData: a.customData, priceId: "pri_not_ours" }))).json.outcome).toBe("ignored_unknown_price");

    await deliver(subscriptionEvent({ customData: a.customData, subId: "sub_first" }));
    const second = await deliver(subscriptionEvent({ customData: a.customData, subId: "sub_second", priceId: "pri_medisea_m" }));
    expect(second.json.outcome).toBe("ignored_existing_subscription");
    expect((await getLicenseOverview(a.org.id)).license?.plan).toBe("indiana");
  });

  it("a Paddle trial counts as a trial license until Paddle converts it", async () => {
    const a = await trialOrg("paid-trial");
    const event = subscriptionEvent({ customData: a.customData, status: "trialing", priceId: "pri_medisea_m" });
    (event.data.items[0] as { trial_dates: unknown }).trial_dates = { ends_at: new Date(Date.now() + 14 * DAY).toISOString() };
    await deliver(event);
    expect((await getLicenseOverview(a.org.id)).license).toMatchObject({ plan: "medisea", source: "paddle", state: "trial" });
  });

  it("other users of the org can't be the subject: only the org matters, and a stranger's org is untouched", async () => {
    const a = await trialOrg("owner-org");
    const stranger = await createUser();
    const strangerOrg = await createOrgWithOwner("stranger-org", stranger, { license: "trial" });
    await deliver(subscriptionEvent({ customData: a.customData }));
    expect((await getLicenseOverview(strangerOrg.org.id)).license?.source).toBe("trial");
  });
});
