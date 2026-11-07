import "server-only";
import { transaction } from "@/server/database/client";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { ConflictError } from "@/lib/errors";
import { paddleApiBase } from "./paddle-transactions";
import { applySubscription, type ApplyOutcome, type PaddleSubscription } from "./paddle-webhook";

/**
 * Activates or refreshes a license by reading the subscription straight from
 * Paddle's API with the secret PADDLE_API_KEY. It is the same check as a
 * webhook (Paddle is the source of truth, the browser is not), so a purchase
 * activates even when the webhook is late or not set up yet.
 */

export type SyncResult =
  | { kind: "not-configured" }
  | { kind: "none" }
  | { kind: "error" }
  | { kind: "done"; outcome: ApplyOutcome };

type Env = Record<string, string | undefined>;

async function paddleGet<T>(path: string, env: Env, fetchImpl: typeof fetch): Promise<T | null> {
  const res = await fetchImpl(`${paddleApiBase(env)}${path}`, { headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}` }, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Paddle API ${res.status}`);
  return (await res.json()) as T;
}

const SUB_ID = /^sub_[a-z0-9]{10,64}$/;
const LIVE = "active,trialing,past_due,paused";

/** The newest live subscription whose signed checkout binds it to this organization. */
async function findSubscriptionFor(organizationId: string, env: Env, fetchImpl: typeof fetch): Promise<PaddleSubscription | null> {
  let path: string | null = `/subscriptions?status=${LIVE}&per_page=200&order_by=id[DESC]`;
  for (let page = 0; path && page < 5; page++) {
    const body: { data?: PaddleSubscription[]; meta?: { pagination?: { next?: string; has_more?: boolean } } } | null = await paddleGet(path, env, fetchImpl);
    const hit = body?.data?.find((s) => s.custom_data?.organizationId === organizationId);
    if (hit) return hit;
    const next: string | null = body?.meta?.pagination?.has_more ? (body.meta.pagination.next ?? null) : null;
    path = next ? next.replace(/^https?:\/\/[^/]+/, "") : null;
  }
  return null;
}

/**
 * @param subscriptionId when known (from a confirmed transaction), read just that one;
 *   otherwise look for this organization's subscription.
 */
export async function syncLicenseFromPaddle(
  organizationId: string,
  opts: { subscriptionId?: string | null; env?: Env; fetchImpl?: typeof fetch } = {},
): Promise<SyncResult> {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!env.PADDLE_API_KEY) return { kind: "not-configured" };
  try {
    let sub: PaddleSubscription | null = null;
    if (opts.subscriptionId && SUB_ID.test(opts.subscriptionId)) {
      sub = (await paddleGet<{ data: PaddleSubscription }>(`/subscriptions/${opts.subscriptionId}`, env, fetchImpl))?.data ?? null;
    } else {
      sub = await findSubscriptionFor(organizationId, env, fetchImpl);
    }
    // applySubscription re-checks the signed checkout token, so a subscription
    // bound to another organization can never be applied here.
    if (!sub || sub.custom_data?.organizationId !== organizationId) return { kind: "none" };
    const occurredAt = sub.updated_at ? new Date(sub.updated_at) : new Date();
    const { outcome } = await transaction((tx) => applySubscription(tx, sub!, occurredAt, { source: "system", event: "subscription.synced" }));
    return { kind: "done", outcome };
  } catch (e) {
    console.error("[paddle-sync]", e instanceof Error ? e.message : e);
    return { kind: "error" };
  }
}

/** The "Sync with Paddle" button on the billing page. Owner-only (billing.manage). */
export async function syncMyLicense(ctx: OrgContext): Promise<SyncResult> {
  assertPermission(ctx, "billing.manage");
  const result = await syncLicenseFromPaddle(ctx.organizationId);
  if (result.kind === "done" && result.outcome === "ignored_existing_subscription") {
    throw new ConflictError("This workspace already has another active subscription in Paddle.");
  }
  return result;
}
