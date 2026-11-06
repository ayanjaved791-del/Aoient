import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic routing only: if there is no session cookie at all, send the
 * visitor to sign-in. This is NOT the security boundary — every page, action
 * and route handler re-validates the session and tenant membership on the server.
 */
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/verify-email", "/forgot-password", "/reset-password", "/invite", "/api", "/_next"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const hasSession = req.cookies.getAll().some((c) => c.name.endsWith("better-auth.session_token"));
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
