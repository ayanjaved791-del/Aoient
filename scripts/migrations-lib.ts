import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const DIR = join(process.cwd(), "supabase", "migrations");
/** Any constant works; it just has to be the same for every deploy. */
const MIGRATION_LOCK = 727_274_001;

/**
 * Applies supabase/migrations/*.sql in order. Each file runs once, in its own
 * transaction, and is recorded in public.schema_migration (the same table
 * supabase/setup.sql uses, so the two ways never apply a file twice).
 *
 * Safe when two deploys run at once: each file's transaction takes an advisory
 * lock and re-checks whether the file was applied meanwhile. Works through
 * Supabase's poolers (no prepared statements).
 */
export async function applyMigrations(url: string, opts: { log?: boolean; preamble?: string } = {}): Promise<string[]> {
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  const applied: string[] = [];
  try {
    if (opts.preamble) await sql.unsafe(opts.preamble);
    await sql.begin(async (tx) => {
      // Locked too: two deploys creating this table at once would otherwise collide.
      await tx`select pg_advisory_xact_lock(${MIGRATION_LOCK})`;
      await tx.unsafe(`
        create table if not exists public.schema_migration (name text primary key, applied_at timestamptz not null default now());
        alter table public.schema_migration enable row level security;
      `);
    });
    for (const file of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
      const body = readFileSync(join(DIR, file), "utf8");
      const ran = await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${MIGRATION_LOCK})`;
        const [done] = await tx`select 1 from public.schema_migration where name = ${file}`;
        if (done) return false;
        await tx.unsafe(body);
        await tx`insert into public.schema_migration (name) values (${file})`;
        return true;
      });
      if (ran) {
        applied.push(file);
        if (opts.log) console.log(`applied ${file}`);
      }
    }
    if (opts.log) console.log(applied.length ? `Database updated (${applied.length} migration${applied.length === 1 ? "" : "s"}).` : "Database is up to date.");
    return applied;
  } finally {
    await sql.end();
  }
}
