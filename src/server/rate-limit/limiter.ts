import "server-only";
import { getDb } from "@/server/database/client";
import { RateLimitedError } from "@/lib/errors";

/**
 * Database-backed fixed-window limiter for application endpoints (sign-in and
 * sign-up are limited by Supabase Auth). A single atomic upsert per call keeps
 * it correct across multiple app instances.
 */
export async function enforceRateLimit(key: string, opts: { max: number; windowSeconds: number }): Promise<void> {
  const sql = getDb();
  const [row] = await sql<{ count: number; window_start: Date }[]>`
    insert into rate_limit_bucket (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limit_bucket.window_start < now() - make_interval(secs => ${opts.windowSeconds})
                   then 1 else rate_limit_bucket.count + 1 end,
      window_start = case when rate_limit_bucket.window_start < now() - make_interval(secs => ${opts.windowSeconds})
                   then now() else rate_limit_bucket.window_start end
    returning count, window_start`;
  if (row && row.count > opts.max) {
    const elapsed = (Date.now() - row.window_start.getTime()) / 1000;
    throw new RateLimitedError(Math.max(1, Math.ceil(opts.windowSeconds - elapsed)));
  }
}
