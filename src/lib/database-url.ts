/**
 * The server's Postgres connection string.
 *
 * `DATABASE_URL` wins. Otherwise `POSTGRES_URL`, which the Supabase integration
 * on Vercel sets automatically (transaction pooler, port 6543). That URL carries
 * a `supa=…` marker the Postgres driver would send to the server as a setting
 * and fail on, so it is removed.
 *
 * Pure (no `server-only`) so scripts and unit tests can use it.
 */
export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const raw = env.DATABASE_URL || env.POSTGRES_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("supa")) return raw;
    url.searchParams.delete("supa");
    return url.toString();
  } catch {
    return raw;
  }
}
