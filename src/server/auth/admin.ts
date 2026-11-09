import "server-only";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { ConflictError } from "@/lib/errors";

/**
 * Server-only Supabase Auth admin calls (creating a login, setting a temporary
 * password). They need the secret service-role key, which never reaches the
 * browser. Vercel's Supabase integration provides it as SUPABASE_SERVICE_ROLE_KEY
 * (newer projects: SUPABASE_SECRET_KEY).
 */
type Env = Record<string, string | undefined>;
export interface AdminOptions { env?: Env; fetchImpl?: typeof fetch }

export function authAdminKey(env: Env = process.env): string | null {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || null;
}

export class AuthAdminNotConfiguredError extends ConflictError {
  constructor() {
    super("Creating logins needs the Supabase service role key on the server (SUPABASE_SERVICE_ROLE_KEY). Add it in Vercel → Settings → Environment Variables, or send an invite link instead.");
  }
}

async function call(path: string, init: RequestInit, opts: AdminOptions): Promise<Response> {
  const env = opts.env ?? process.env;
  const key = authAdminKey(env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
  if (!key || !url) throw new AuthAdminNotConfiguredError();
  return (opts.fetchImpl ?? fetch)(`${url.replace(/\/$/, "")}/auth/v1${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
}

/** Creates a confirmed email/password login. Refuses emails that already have an account. */
export async function createAuthUser(u: { email: string; password: string; name: string }, opts: AdminOptions = {}): Promise<string> {
  const res = await call("/admin/users", { method: "POST", body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true, user_metadata: { name: u.name } }) }, opts);
  const body = (await res.json().catch(() => ({}))) as { id?: string; code?: string; error_code?: string; msg?: string; message?: string };
  if (res.status === 422 || res.status === 409 || body.error_code === "email_exists" || body.code === "email_exists") {
    throw new ConflictError("This email already has an Aoient account. Send them an invite link instead, so they join with their existing password.");
  }
  if (!res.ok || !body.id) throw new Error(`Supabase admin createUser failed (${res.status}): ${body.msg ?? body.message ?? "unknown"}`);
  return body.id;
}

export async function setAuthUserPassword(userId: string, password: string, opts: AdminOptions = {}): Promise<void> {
  const res = await call(`/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ password }) }, opts);
  if (!res.ok) throw new Error(`Supabase admin updateUser failed (${res.status})`);
}

/** Best-effort cleanup when a login was created but the membership couldn't be saved. */
export async function deleteAuthUser(userId: string, opts: AdminOptions = {}): Promise<void> {
  await call(`/admin/users/${userId}`, { method: "DELETE" }, opts).catch(() => undefined);
}

/**
 * Self sign-up when Supabase can't send the confirmation email. The login is
 * confirmed so the person can sign in, but app_metadata (server-only) marks the
 * address as unproven, so the profile keeps `email_verified = false`.
 * Returns null when the email already has a login.
 */
export async function createUnprovenUser(u: { email: string; password: string; name: string }, opts: AdminOptions = {}): Promise<string | null> {
  const res = await call("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true, user_metadata: { name: u.name }, app_metadata: { aoient_email_unproven: true } }),
  }, opts);
  const body = (await res.json().catch(() => ({}))) as { id?: string; code?: string; error_code?: string; msg?: string; message?: string };
  if (res.status === 422 || res.status === 409 || body.error_code === "email_exists" || body.code === "email_exists") return null;
  if (!res.ok || !body.id) throw new Error(`Supabase admin createUser failed (${res.status}): ${body.msg ?? body.message ?? "unknown"}`);
  return body.id;
}

/** Finishes a sign-up Supabase started but couldn't email: same marking as createUnprovenUser. */
export async function confirmUnprovenUser(userId: string, u: { password: string; name: string }, opts: AdminOptions = {}): Promise<void> {
  const res = await call(`/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ password: u.password, email_confirm: true, user_metadata: { name: u.name }, app_metadata: { aoient_email_unproven: true } }),
  }, opts);
  if (!res.ok) throw new Error(`Supabase admin updateUser failed (${res.status})`);
}

/**
 * A one-time sign-in token for a login the server just created. Nothing is
 * emailed; the caller exchanges it for a session cookie straight away.
 */
export async function createSignInTokenHash(email: string, opts: AdminOptions = {}): Promise<string> {
  const res = await call("/admin/generate_link", { method: "POST", body: JSON.stringify({ type: "magiclink", email }) }, opts);
  const body = (await res.json().catch(() => ({}))) as { hashed_token?: string; properties?: { hashed_token?: string } };
  const hash = body.hashed_token ?? body.properties?.hashed_token;
  if (!res.ok || !hash) throw new Error(`Supabase admin generate_link failed (${res.status})`);
  return hash;
}
