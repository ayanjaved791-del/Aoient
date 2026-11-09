import "server-only";
import { getDb } from "@/server/database/client";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { RateLimitedError } from "@/lib/errors";

export type SignInFailureReason =
  /** No Aoient account uses this email. */
  | "no-account"
  /** The account exists; the password was wrong (or it signs in with Google). */
  | "wrong-password"
  /** The account exists but its email isn't confirmed yet. */
  | "unconfirmed"
  /** The account was turned off. */
  | "deactivated"
  /** Too many lookups: say nothing more specific. */
  | "unknown";

/**
 * After Supabase rejects a sign-in, tells the person whether the email has an
 * account at all, so they know to sign up instead of retrying passwords.
 *
 * This does reveal whether an email is registered (sign-up reveals it too).
 * To keep that from being used to test lists of emails, it is limited per
 * network address and per email, and only says "unknown" once over the limit.
 */
export async function explainSignInFailure(email: string, clientKey: string): Promise<SignInFailureReason> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 320 || !normalized.includes("@")) return "unknown";
  try {
    await enforceRateLimit(`signin-lookup:ip:${clientKey}`, { max: 20, windowSeconds: 3600 });
    await enforceRateLimit(`signin-lookup:email:${normalized}`, { max: 10, windowSeconds: 3600 });
  } catch (e) {
    if (e instanceof RateLimitedError) return "unknown";
    throw e;
  }
  const [row] = await getDb()<{ email_verified: boolean; email_unproven: boolean; status: string }[]>`
    select email_verified, email_unproven, status from profile where lower(email) = ${normalized}`;
  if (!row) return "no-account";
  if (row.status !== "active") return "deactivated";
  if (!row.email_verified && !row.email_unproven) return "unconfirmed";
  return "wrong-password";
}

/** A stable key for the caller's network address (from the hosting platform's headers). */
export function clientKeyFrom(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (h.get("x-real-ip") || forwarded || "unknown").slice(0, 64);
}
