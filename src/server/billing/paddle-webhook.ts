import "server-only";
import { createHmac } from "node:crypto";
import { transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { safeEqual } from "@/lib/tokens";
import { isUuid } from "@/lib/ids";
import { planForPriceId } from "@/lib/billing/plans";
import { verifyCheckout } from "./checkout-token";

/**
 * Paid licenses come only from Paddle itself: its signed webhooks, or (see
 * paddle-sync.ts) a server-side read of the subscription from Paddle's API
 * with the secret API key. Never from the browser.
 *
 * 1. The signature proves the request came from Paddle (HMAC-SHA256 of
 *    "ts:body" with PADDLE_WEBHOOK_SECRET, timestamp within 5 minutes).
 * 2. Each event ID is stored once, so Paddle's retries are not applied twice.
 * 3. Events older than the last one applied to a subscription are ignored.
 * 4. The plan comes from the Paddle price ID (not from custom_data).
 * 5. The organization comes from the subscription we already know, or from a
 *    server-signed checkout token (see checkout-token.ts).
 */

const TOLERANCE_SECONDS = 5 * 60;

export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(";").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const ts = Number(parts.ts);
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  // Paddle may send several h1 values while a secret is being rotated.
  const signatures = header
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("h1="))
    .map((p) => p.slice(3));
  return signatures.some((sig) => safeEqual(sig, expected));
}

export interface PaddleSubscription {
  id: string;
  status: string;
  customer_id?: string;
  custom_data?: { organizationId?: unknown; checkoutToken?: unknown } | null;
  items?: { price?: { id?: string }; trial_dates?: { ends_at?: string } | null }[];
  current_billing_period?: { ends_at?: string } | null;
  canceled_at?: string | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
  updated_at?: string;
}

export interface PaddleEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: unknown;
}

export type WebhookOutcome =
  | "applied"
  | "duplicate"
  | "ignored_event_type"
  | "ignored_stale"
  | "ignored_unknown_price"
  | "ignored_unknown_organization"
  | "ignored_existing_subscription";

const STATUSES = new Set(["trialing", "active", "past_due", "paused", "canceled"]);

export async function processPaddleEvent(event: PaddleEvent): Promise<WebhookOutcome> {
  if (!event.event_type.startsWith("subscription.")) {
    return recordOnly(event, null, "ignored_event_type");
  }
  const sub = event.data as PaddleSubscription;
  const occurredAt = new Date(event.occurred_at);

  return transaction(async (tx) => {
    const [first] = await tx`
      insert into paddle_webhook_event (event_id, event_type, occurred_at, outcome)
      values (${event.event_id}, ${event.event_type}, ${occurredAt}, 'processing')
      on conflict (event_id) do nothing
      returning event_id`;
    if (!first) return "duplicate";

    const finish = async (outcome: WebhookOutcome, organizationId: string | null = null) => {
      await tx`update paddle_webhook_event set outcome = ${outcome}, organization_id = ${organizationId} where event_id = ${event.event_id}`;
      return outcome;
    };

    const { outcome, organizationId } = await applySubscription(tx, sub, occurredAt, { source: "webhook", event: event.event_type });
    return finish(outcome, organizationId);
  });
}

export type ApplyOutcome = Exclude<WebhookOutcome, "duplicate" | "ignored_event_type">;

/**
 * Writes a Paddle subscription onto the organization's license, inside the
 * caller's transaction. Shared by the webhook and the API sync so both follow
 * exactly the same rules (price → plan, signed organization binding, one live
 * subscription per organization, stale updates ignored).
 */
export async function applySubscription(
  tx: Db,
  sub: PaddleSubscription,
  occurredAt: Date,
  via: { source: "webhook" | "system"; event: string },
): Promise<{ outcome: ApplyOutcome; organizationId: string | null }> {
  const finish = async (outcome: ApplyOutcome, organizationId: string | null = null) => ({ outcome, organizationId });
    const mapped = planForPriceId(sub.items?.[0]?.price?.id);
    if (!mapped || !STATUSES.has(sub.status)) return finish("ignored_unknown_price");

    const organizationId = await resolveOrganization(tx, sub);
    if (!organizationId) return finish("ignored_unknown_organization");

    await tx`select 1 from organization where id = ${organizationId} for update`;
    const [current] = await tx<{ paddle_subscription_id: string | null; paddle_event_at: Date | null; status: string; source: string; current_period_ends_at: Date | null }[]>`
      select paddle_subscription_id, paddle_event_at, status, source, current_period_ends_at
      from organization_license where organization_id = ${organizationId}`;

    if (current?.paddle_subscription_id && current.paddle_subscription_id !== sub.id) {
      // A different subscription already pays for this organization. Don't let a
      // second checkout silently replace it unless the old one has ended.
      const oldStillLive =
        current.status !== "canceled" || (current.current_period_ends_at && current.current_period_ends_at > new Date());
      if (oldStillLive) return finish("ignored_existing_subscription", organizationId);
    }
    if (current?.paddle_subscription_id === sub.id && current.paddle_event_at && current.paddle_event_at > occurredAt) {
      return finish("ignored_stale", organizationId);
    }

    const trialEndsAt = sub.status === "trialing" ? toDate(sub.items?.[0]?.trial_dates?.ends_at ?? sub.current_billing_period?.ends_at) : null;
    const periodEndsAt =
      sub.status === "canceled"
        ? toDate(sub.canceled_at) ?? occurredAt
        : toDate(sub.current_billing_period?.ends_at);

    await tx`
      insert into organization_license
        (organization_id, plan, billing_interval, status, source, trial_ends_at, current_period_ends_at,
         paddle_subscription_id, paddle_customer_id, paddle_event_at)
      values
        (${organizationId}, ${mapped.plan}, ${mapped.interval}, ${sub.status}, 'paddle', ${trialEndsAt}, ${periodEndsAt},
         ${sub.id}, ${sub.customer_id ?? null}, ${occurredAt})
      on conflict (organization_id) do update set
        plan = excluded.plan, billing_interval = excluded.billing_interval, status = excluded.status, source = 'paddle',
        trial_ends_at = excluded.trial_ends_at, current_period_ends_at = excluded.current_period_ends_at,
        paddle_subscription_id = excluded.paddle_subscription_id, paddle_customer_id = excluded.paddle_customer_id,
        paddle_event_at = excluded.paddle_event_at, updated_at = now()`;

    await recordAudit(tx, {
      organizationId,
      actorUserId: null,
      action: "billing.license_updated",
      source: via.source,
      targetType: "subscription",
      targetId: sub.id,
      metadata: { event: via.event, plan: mapped.plan, interval: mapped.interval, status: sub.status },
    });
  return finish("applied", organizationId);
}

async function resolveOrganization(tx: Db, sub: PaddleSubscription): Promise<string | null> {
  const [known] = await tx<{ organization_id: string }[]>`
    select organization_id from organization_license where paddle_subscription_id = ${sub.id}`;
  if (known) return known.organization_id;

  const orgId = sub.custom_data?.organizationId;
  if (typeof orgId !== "string" || !isUuid(orgId)) return null;
  const userId = verifyCheckout(orgId, sub.custom_data?.checkoutToken);
  if (!userId) return null;
  const [org] = await tx<{ id: string }[]>`select id from organization where id = ${orgId}`;
  return org?.id ?? null;
}

async function recordOnly(event: PaddleEvent, organizationId: string | null, outcome: WebhookOutcome): Promise<WebhookOutcome> {
  return transaction(async (tx) => {
    const [first] = await tx`
      insert into paddle_webhook_event (event_id, event_type, occurred_at, organization_id, outcome)
      values (${event.event_id}, ${event.event_type}, ${new Date(event.occurred_at)}, ${organizationId}, ${outcome})
      on conflict (event_id) do nothing returning event_id`;
    return first ? outcome : "duplicate";
  });
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
