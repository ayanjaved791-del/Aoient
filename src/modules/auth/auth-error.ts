/**
 * Maps Better Auth client errors to user-facing text. Server failures and
 * origin mismatches get their own messages so a broken setup is never reported
 * as a mistake by the user (e.g. "incorrect password").
 */
export function describeAuthError(
  error: { status?: number; code?: string; message?: string },
  fallback: string,
): string {
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (error.status === 403 && /origin/i.test(error.message ?? "")) {
    return "This address isn't allowed to sign in. Open the app at the URL set in APP_URL (for example http://localhost:3000, not 127.0.0.1).";
  }
  if (!error.status || error.status >= 500) {
    return "The server couldn't complete this request. If you run Aoient yourself, run `npm run doctor` to check the database and settings.";
  }
  return error.message || fallback;
}
