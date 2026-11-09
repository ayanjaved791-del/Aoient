import "server-only";
import { getDb } from "@/server/database/client";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { parseInput } from "@/lib/validation/parse";
import { signUpSchema } from "@/lib/validation/auth";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { authAdminKey, confirmUnprovenUser, createSignInTokenHash, createUnprovenUser, type AdminOptions } from "./admin";

/**
 * Sign-up when Supabase Auth can't send the confirmation email (its built-in
 * email service only delivers to the project's own team, a few times an hour).
 * The browser tries Supabase first; only when that refuses for an email reason
 * does it come here. The login is created on the server and marked as having an
 * unproven email (see the 20261115 migration), then signed in.
 */
type Env = Record<string, string | undefined>;

export function isServerSignUpAvailable(env: Env = process.env): boolean {
  return Boolean(authAdminKey(env));
}

/**
 * Supabase verifies the Turnstile token on its own sign-up, but this path skips
 * that, so it checks the token itself. With Turnstile on and no secret key on
 * the server, it refuses rather than let bots through.
 */
async function checkCaptcha(token: string | undefined, clientKey: string, env: Env, fetchImpl: typeof fetch) {
  if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return;
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new ForbiddenError("Sign-up needs TURNSTILE_SECRET_KEY on the server while the bot check is on. Ask the site owner to add it.");
  if (!token) throw new ForbiddenError("Complete the security check, then try again.");
  const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, ...(clientKey !== "unknown" ? { remoteip: clientKey } : {}) }),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!body.success) throw new ForbiddenError("The security check didn't pass. Complete it again and retry.");
}

/**
 * A sign-up Supabase began but couldn't email leaves an unconfirmed login. It
 * may be finished here only while it is fresh and empty: never confirmed,
 * under an hour old and in no organization.
 */
async function findStuckSignUp(email: string): Promise<string | null> {
  const [row] = await getDb()<{ id: string }[]>`
    select p.id from profile p
    where lower(p.email) = ${email} and not p.email_verified and not p.email_unproven
      and p.status = 'active' and p.created_at > now() - interval '1 hour'
      and not exists (select 1 from organization_member m where m.user_id = p.id)`;
  return row?.id ?? null;
}

export async function signUpWithoutEmail(
  input: unknown,
  opts: { clientKey: string; captchaToken?: string; env?: Env; fetchImpl?: typeof fetch },
): Promise<{ email: string; tokenHash: string }> {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const admin: AdminOptions = { env, fetchImpl };
  if (!isServerSignUpAvailable(env)) {
    throw new ConflictError("We couldn't send your confirmation email, and this site isn't set up to create accounts without one yet (SUPABASE_SERVICE_ROLE_KEY is missing).");
  }
  const data = parseInput(signUpSchema, input);
  await enforceRateLimit(`signup:ip:${opts.clientKey}`, { max: 5, windowSeconds: 3600 });
  await enforceRateLimit(`signup:email:${data.email}`, { max: 3, windowSeconds: 3600 });
  await checkCaptcha(opts.captchaToken, opts.clientKey, env, fetchImpl);

  const created = await createUnprovenUser({ email: data.email, password: data.password, name: data.name }, admin);
  if (!created) {
    const stuck = await findStuckSignUp(data.email);
    if (!stuck) throw new ConflictError("An account with this email already exists. Sign in instead.");
    await confirmUnprovenUser(stuck, { password: data.password, name: data.name }, admin);
  }
  return { email: data.email, tokenHash: await createSignInTokenHash(data.email, admin) };
}
