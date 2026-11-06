/**
 * Postgres connection strings.
 *
 * `DATABASE_URL` wins. Otherwise the variables the Supabase integration on
 * Vercel sets automatically: `POSTGRES_URL` (transaction pooler, port 6543) for
 * the app, and `POSTGRES_URL_NON_POOLING` (session connection) for migrations.
 * Those URLs carry a `supa=…` marker the Postgres driver would send to the
 * server as a setting and fail on, so it is removed.
 *
 * Pure (no `server-only`) so scripts and unit tests can use it.
 */
type Env = Record<string, string | undefined>;

function withoutSupaMarker(raw: string): string {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("supa")) return raw;
    url.searchParams.delete("supa");
    return url.toString();
  } catch {
    return raw;
  }
}

/** For the running app. */
export function resolveDatabaseUrl(env: Env = process.env): string | undefined {
  const raw = env.DATABASE_URL || env.POSTGRES_URL;
  return raw ? withoutSupaMarker(raw) : undefined;
}

/** For schema changes: prefer a direct/session connection over the transaction pooler. */
export function resolveMigrationUrl(env: Env = process.env): string | undefined {
  const raw = env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || env.POSTGRES_URL;
  return raw ? withoutSupaMarker(raw) : undefined;
}
