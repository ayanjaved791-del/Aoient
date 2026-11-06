/**
 * Public base URL for links in emails (no trailing slash).
 * `APP_URL` wins; on Vercel without it, the project's production domain
 * (`VERCEL_PROJECT_PRODUCTION_URL`, set by Vercel); locally, localhost.
 */
export function resolveAppUrl(env: Record<string, string | undefined> = process.env): string {
  const url = env.APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}
