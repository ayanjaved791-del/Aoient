import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const DIR = join(process.cwd(), "supabase", "migrations");

export async function applyMigrations(url: string, opts: { log?: boolean; preamble?: string } = {}) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    if (opts.preamble) await sql.unsafe(opts.preamble);
    await sql.unsafe(`
      create table if not exists public.schema_migration (name text primary key, applied_at timestamptz not null default now());
      alter table public.schema_migration enable row level security;
    `);
    const done = new Set((await sql<{ name: string }[]>`select name from public.schema_migration`).map((r) => r.name));
    for (const file of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(file)) continue;
      const body = readFileSync(join(DIR, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into public.schema_migration (name) values (${file})`;
      });
      if (opts.log) console.log(`applied ${file}`);
    }
    if (opts.log) console.log("Database is up to date.");
  } finally {
    await sql.end();
  }
}
