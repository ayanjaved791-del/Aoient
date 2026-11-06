import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/server/auth/supabase";
import { safeNextPath } from "@/lib/validation/auth";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "invite", "magiclink", "email_change"]);

/**
 * Landing point for Supabase Auth email links (verification and password reset).
 * Supports both link styles:
 *  - `?token_hash=…&type=…` (recommended email template; works on any device)
 *  - `?code=…` (Supabase's default PKCE link; must be opened in the same browser)
 * On success the session cookie is set and the user continues to `next`.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const isRecovery = type === "recovery" || url.searchParams.get("next") === "/reset-password";
  const next = isRecovery ? "/reset-password" : safeNextPath(url.searchParams.get("next"), "/pricing");
  const failTo = new URL(isRecovery ? "/reset-password?error=invalid" : "/verify-email?error=invalid", url.origin);

  const supabase = await getSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(failTo);

  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  let ok = false;
  if (tokenHash && type && OTP_TYPES.has(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }
  return NextResponse.redirect(ok ? new URL(next, url.origin) : failTo);
}
