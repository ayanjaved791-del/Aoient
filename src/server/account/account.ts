import "server-only";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "@/server/database/client";
import { getSupabaseServerClient } from "@/server/auth/supabase";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { ConflictError, ValidationError } from "@/lib/errors";
import { parseInput } from "@/lib/validation/parse";
import type { SessionUser } from "@/server/auth/session";

/**
 * Your own account: name, sign-in email and password. Changes go through
 * Supabase Auth; a database trigger mirrors name and email into `profile`,
 * which is what admins see in Members and People.
 */

export interface AccountView {
  name: string;
  email: string;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  managedBy: string | null;
}

export async function getAccount(user: SessionUser): Promise<AccountView> {
  const [row] = await getDb()<{ name: string; email: string; must_change_password: boolean; password_changed_at: Date | null; managed_by: string | null }[]>`
    select p.name, p.email, p.must_change_password, p.password_changed_at, o.name as managed_by
    from profile p left join organization o on o.id = p.managed_by_organization_id
    where p.id = ${user.id}`;
  return { name: row.name, email: row.email, mustChangePassword: row.must_change_password, passwordChangedAt: row.password_changed_at, managedBy: row.managed_by };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  password: z.string().min(10, "Use at least 10 characters").max(128, "Use 128 characters or fewer"),
  confirmPassword: z.string(),
  /** Turnstile token, needed when bot protection is on in Supabase. */
  captchaToken: z.string().max(4096).optional(),
}).refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((v) => v.password !== v.currentPassword, { path: ["password"], message: "Choose a password different from the current one" });

/** Records that the person chose their own password (clears the "temporary password" flag). */
export async function markPasswordChanged(userId: string): Promise<void> {
  await getDb()`update profile set must_change_password = false, password_changed_at = now(), updated_at = now() where id = ${userId}`;
}

export async function changePassword(user: SessionUser, input: unknown): Promise<void> {
  const data = parseInput(passwordSchema, input);
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new ConflictError("Sign-in isn't configured on this server.");
  // Confirm the current password with a throwaway client so this session's cookies aren't touched.
  const probe = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = await probe.auth.signInWithPassword({ email: user.email, password: data.currentPassword, options: { captchaToken: data.captchaToken } });
  if (check.error?.code === "captcha_failed") throw new ValidationError("The security check didn't pass. Complete it again and retry.");
  if (check.error) throw new ValidationError("Your current password isn't right.", { currentPassword: ["Your current password isn't right"] });
  await probe.auth.signOut({ scope: "local" }).catch(() => undefined);
  const { error } = await supabase.auth.updateUser({ password: data.password });
  if (error) throw new ValidationError(error.message || "Couldn't update your password.", { password: [error.message || "Couldn't update your password"] });
  await markPasswordChanged(user.id);
}

const nameSchema = z.object({ name: z.string().trim().min(2, "Enter your full name").max(80, "Use 80 characters or fewer") });

export async function changeName(user: SessionUser, input: unknown): Promise<void> {
  const { name } = parseInput(nameSchema, input);
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new ConflictError("Sign-in isn't configured on this server.");
  const { error } = await supabase.auth.updateUser({ data: { name } });
  if (error) throw new ValidationError(error.message, { name: [error.message] });
  await getDb()`update profile set name = ${name}, updated_at = now() where id = ${user.id}`;
}

const emailSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")) });

/** Supabase emails a confirmation link; the change applies (and shows to admins) once confirmed. */
export async function changeEmail(user: SessionUser, input: unknown): Promise<{ pending: boolean }> {
  const { email } = parseInput(emailSchema, input);
  if (email === user.email.toLowerCase()) throw new ValidationError("That's already your email.", { email: ["That's already your email"] });
  const [taken] = await getDb()`select 1 from profile where lower(email) = ${email} and id <> ${user.id}`;
  if (taken) throw new ConflictError("Another account already uses this email.");
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new ConflictError("Sign-in isn't configured on this server.");
  const { data, error } = await supabase.auth.updateUser({ email });
  if (error) throw new ValidationError(error.message, { email: [error.message] });
  // With email confirmation on, the address changes only after the link is clicked.
  return { pending: (data.user?.email ?? "").toLowerCase() !== email };
}
