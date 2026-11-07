import "server-only";
import { redirect } from "next/navigation";
import { getDb } from "@/server/database/client";
import { getSupabaseServerClient } from "./supabase";
import { UnauthorizedError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /** Signed in with a temporary password an admin set: must choose their own first. */
  mustChangePassword: boolean;
}

/**
 * Data Access Layer entry point. Supabase Auth verifies the session token
 * (`getClaims` checks the JWT signature), then the user's profile row decides
 * the rest: deactivated users are treated as signed out.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !isUuid(userId)) return null;

  const [profile] = await getDb()<{ name: string; email: string; email_verified: boolean; status: string; must_change_password: boolean }[]>`
    select name, email, email_verified, status, must_change_password from profile where id = ${userId}`.catch((e: { code?: string }) => {
    if (e?.code === "42P01") {
      throw new Error(
        "Aoient's tables are missing in the database the server connects to (DATABASE_URL, or POSTGRES_URL on Vercel). " +
          "Run supabase/setup.sql in the SQL Editor of that same Supabase project.",
      );
    }
    throw e;
  });
  if (!profile || profile.status !== "active") return null;
  return { id: userId, name: profile.name, email: profile.email, emailVerified: profile.email_verified, mustChangePassword: profile.must_change_password };
}

/** For route handlers / server actions: throws 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** For pages: redirects to sign-in, preserving the destination. */
export async function requireUserOrRedirect(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(returnTo ? `/sign-in?next=${encodeURIComponent(returnTo)}` : "/sign-in");
  // A login an admin created starts with a temporary password: choose your own first.
  if (user.mustChangePassword) redirect(`/account?setup=password${returnTo ? `&next=${encodeURIComponent(returnTo)}` : ""}`);
  return user;
}
