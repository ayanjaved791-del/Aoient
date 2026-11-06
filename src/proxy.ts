import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * 1. Keeps the Supabase session fresh: refreshed auth cookies are written to
 *    both the request (for this render) and the response (for the browser).
 * 2. Optimistic routing: signed-out visitors to app pages go to sign-in.
 *
 * This is NOT the security boundary — every page, action and route handler
 * re-validates the session and tenant membership on the server.
 */
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/verify-email", "/forgot-password", "/reset-password", "/invite", "/auth", "/api", "/_next"];

function isPublic(pathname: string) {
  return pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function toSignIn(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

/**
 * When Supabase can't use the requested redirect (not allow-listed) it sends the
 * visitor to the Site URL root instead:
 *  - `?code=…` (link verified): finish sign-in on /auth/confirm.
 *  - `?error_code=…` (expired, already used): go where a new link can be requested.
 */
function emailLinkFallback(req: NextRequest) {
  if (req.nextUrl.pathname !== "/") return null;
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error_code");
  if (!code && !error) return null;
  const url = req.nextUrl.clone();
  url.pathname = code ? "/auth/confirm" : "/verify-email";
  url.search = code ? `?code=${encodeURIComponent(code)}` : `?error=${encodeURIComponent(error!)}`;
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  const fallback = emailLinkFallback(req);
  if (fallback) return fallback;
  if (!isSupabaseConfigured) return isPublic(req.nextUrl.pathname) ? NextResponse.next() : toSignIn(req);

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) res.headers.set(k, v);
      },
    },
  });

  // Verifies (and if needed refreshes) the session. Do not run code between
  // creating the client and this call.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && !isPublic(req.nextUrl.pathname)) {
    const redirect = toSignIn(req);
    for (const c of res.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
