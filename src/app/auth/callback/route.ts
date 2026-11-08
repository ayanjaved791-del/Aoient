import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/server/auth/supabase";
import { revokeTemporaryPassword } from "@/server/auth/claim";
import { safeNextPath } from "@/lib/validation/auth";
import { DESKTOP_APP_PARAM, DESKTOP_APP_VALUE } from "@/lib/desktop";

/**
 * Return point after signing in with Google (or another OAuth provider).
 * Supabase sends `?code=…`, which is exchanged for a session cookie here.
 * Any failure (cancelled consent, provider not set up) goes back to sign-in.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"), "/organizations");
  const failTo = new URL(`/sign-in?error=oauth&next=${encodeURIComponent(next)}`, url.origin);
  const code = url.searchParams.get("code");

  // Sign-in that started in the desktop app finished here, in the system
  // browser. The browser can't complete it (the app holds the matching
  // secret), so hand the code back to the app instead of exchanging it.
  if (url.searchParams.get(DESKTOP_APP_PARAM) === DESKTOP_APP_VALUE) {
    const to = new URL("/auth/desktop", url.origin);
    if (code && !url.searchParams.get("error")) to.searchParams.set("code", code);
    else to.searchParams.set("error", "1");
    to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  }

  if (!code || url.searchParams.get("error")) return NextResponse.redirect(failTo);

  const supabase = await getSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(failTo);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(failTo);

  // The person just proved they own this email. If an admin set a temporary
  // password for it, retire that password so it can't be used to get in.
  if (!(await revokeTemporaryPassword(data.user.id))) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return NextResponse.redirect(failTo);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
