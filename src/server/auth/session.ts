import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "@/server/database/client";
import { UnauthorizedError } from "@/lib/errors";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
}

/**
 * Data Access Layer entry point: validate the session cookie against the
 * database and return a narrow user, or null. Deactivated users are treated as
 * signed out even if a session row still exists.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, emailVerified: true, image: true, status: true },
  });
  if (!user || user.status !== "active") return null;
  return { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, image: user.image };
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
  return user;
}
