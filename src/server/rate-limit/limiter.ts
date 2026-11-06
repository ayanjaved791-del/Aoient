import "server-only";
import { db } from "@/server/database/client";
import { RateLimitedError } from "@/lib/errors";

/**
 * Database-backed fixed-window limiter for application endpoints (auth endpoints
 * are limited separately by Better Auth). A single atomic upsert per call keeps
 * it correct across multiple app instances.
 */
export async function enforceRateLimit(key: string, opts: { max: number; windowSeconds: number }): Promise<void> {
  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "rate_limit_bucket" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limit_bucket"."windowStart" < now() - make_interval(secs => ${opts.windowSeconds})
                     THEN 1 ELSE "rate_limit_bucket"."count" + 1 END,
      "windowStart" = CASE WHEN "rate_limit_bucket"."windowStart" < now() - make_interval(secs => ${opts.windowSeconds})
                     THEN now() ELSE "rate_limit_bucket"."windowStart" END
    RETURNING "count", "windowStart"`;
  const row = rows[0];
  if (row && row.count > opts.max) {
    const elapsed = (Date.now() - row.windowStart.getTime()) / 1000;
    throw new RateLimitedError(Math.max(1, Math.ceil(opts.windowSeconds - elapsed)));
  }
}
