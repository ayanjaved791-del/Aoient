import "server-only";
import postgres from "postgres";
import { resolveDatabaseUrl } from "@/lib/database-url";

/**
 * Server-side connection to the Supabase Postgres database (DATABASE_URL, or
 * POSTGRES_URL from the Vercel Supabase integration).
 *
 * Created lazily on first query, so importing this module never needs the
 * database (the app builds without DATABASE_URL). One pool per process; cached
 * on globalThis so dev hot reloads don't leak connections.
 *
 * On Vercel use Supabase's *transaction pooler* URL (port 6543); prepared
 * statements are disabled for compatibility with it.
 */
export type Sql = postgres.Sql;
/** A connection or an open transaction — every query helper accepts either. */
export type Db = postgres.Sql | postgres.TransactionSql;

const globalForDb = globalThis as unknown as { __aoientSql?: Sql };

function createClient(): Sql {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL (or POSTGRES_URL) is not set. See .env.example.");
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    prepare: false,
    idle_timeout: 20,
    onnotice: () => {},
    transform: { undefined: null },
  });
}

export function getDb(): Sql {
  globalForDb.__aoientSql ??= createClient();
  return globalForDb.__aoientSql;
}

/** Run `fn` in a transaction; it commits when `fn` resolves and rolls back if it throws. */
export async function transaction<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return (await getDb().begin(fn)) as T;
}

/** For tests: close the pool so the process can exit. */
export async function closeDb(): Promise<void> {
  const sql = globalForDb.__aoientSql;
  globalForDb.__aoientSql = undefined;
  await sql?.end({ timeout: 5 });
}
