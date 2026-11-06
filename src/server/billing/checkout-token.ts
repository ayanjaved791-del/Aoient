import "server-only";
import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/tokens";

/**
 * Binds a checkout to the organization it pays for.
 *
 * Paddle passes `custom_data` from the browser back to us in webhooks, so the
 * organization ID in it can't be trusted on its own. When a member with
 * `billing.manage` opens checkout, the server signs (organizationId, userId)
 * with PADDLE_WEBHOOK_SECRET; the webhook only applies a subscription to an
 * organization whose signature checks out.
 */
const VERSION = "v1";

function secret(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.PADDLE_WEBHOOK_SECRET || undefined;
}

function mac(key: string, organizationId: string, userId: string) {
  return createHmac("sha256", key).update(`aoient-checkout:${VERSION}:${organizationId}:${userId}`).digest("base64url");
}

export function signCheckout(organizationId: string, userId: string, env?: Record<string, string | undefined>): string | null {
  const key = secret(env);
  return key ? `${VERSION}.${userId}.${mac(key, organizationId, userId)}` : null;
}

/** Returns the user who started the checkout, or null if the token isn't valid for this organization. */
export function verifyCheckout(organizationId: string, token: unknown, env?: Record<string, string | undefined>): string | null {
  const key = secret(env);
  if (!key || typeof token !== "string") return null;
  const [version, userId, signature] = token.split(".");
  if (version !== VERSION || !userId || !signature) return null;
  return safeEqual(signature, mac(key, organizationId, userId)) ? userId : null;
}
