import { safeNextPath } from "@/lib/validation/auth";

/** The desktop app adds this to its browser name. */
export const DESKTOP_UA_MARKER = "AoientDesktop/";
/** Added to the OAuth return address when sign-in started in the desktop app. */
export const DESKTOP_APP_PARAM = "app";
export const DESKTOP_APP_VALUE = "desktop";

export const isDesktopUserAgent = (ua: string | null | undefined) => !!ua && ua.includes(DESKTOP_UA_MARKER);

const CODE_RE = /^[A-Za-z0-9._~-]{8,512}$/;

/**
 * The `aoient://` link that hands a Google sign-in from the system browser
 * back to the desktop app. The code only works together with the secret the
 * app kept when the sign-in started, so the link is useless anywhere else.
 * Returns null for anything that doesn't look like a sign-in code.
 */
export function desktopReturnLink(code: string | null | undefined, next: string | null | undefined): string | null {
  if (!code || !CODE_RE.test(code)) return null;
  const params = new URLSearchParams({ code, next: safeNextPath(next ?? null, "/organizations") });
  return `aoient://auth/callback?${params.toString()}`;
}
