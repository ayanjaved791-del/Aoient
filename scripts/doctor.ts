/**
 * `npm run doctor` — checks the local setup and explains what to fix.
 * Prints variable NAMES only, never values.
 */
import "dotenv/config";
import { resolveDatabaseUrl } from "../src/lib/database-url";
import postgres from "postgres";

type Result = { ok: boolean; label: string; fix?: string };
const results: Result[] = [];
const check = (ok: boolean, label: string, fix?: string) => results.push({ ok, label, fix });

function validUrl(v: string | undefined) {
  try {
    return Boolean(v && new URL(v));
  } catch {
    return false;
  }
}

async function main() {
  const env = process.env;
  const databaseUrl = resolveDatabaseUrl(env);

  check(validUrl(env.APP_URL), "APP_URL is a full URL", "Set APP_URL in .env, e.g. http://localhost:3000 — the exact address you open in the browser.");
  check(
    validUrl(env.NEXT_PUBLIC_SUPABASE_URL),
    "NEXT_PUBLIC_SUPABASE_URL is set",
    "Copy the Project URL from Supabase → Project Settings → API.",
  );
  check(
    Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is set",
    "Copy the publishable (or legacy anon) key from Supabase → Project Settings → API Keys.",
  );
  check(
    Boolean(databaseUrl),
    "DATABASE_URL (or POSTGRES_URL from Vercel) is set",
    "Copy a connection string from Supabase → Connect (use the transaction pooler URL on Vercel).",
  );

  if (databaseUrl) {
    const sql = postgres(databaseUrl, { max: 1, connect_timeout: 5, onnotice: () => {} });
    try {
      await sql`select 1`;
      check(true, "Database is reachable");
      const [t] = await sql<{ n: number }[]>`
        select count(*)::int as n from information_schema.tables
        where table_schema = 'public' and table_name in ('profile','organization','role','permission','organization_member')`;
      const migrated = t.n === 5;
      check(migrated, "Database tables exist (migrations applied)", "Run: npm run db:migrate");
      if (migrated) {
        const roles = await sql`select 1 from role where is_system and key = 'owner'`;
        check(roles.length > 0, "System roles are seeded", "Run: npm run db:seed  (needed before anyone can create an organization)");
      }
    } catch (e) {
      check(false, "Database is reachable", `Could not connect (${(e as Error).message}). Check DATABASE_URL and the database password.`);
    } finally {
      await sql.end();
    }
  }

  for (const r of results) {
    console.log(`${r.ok ? "✔" : "✘"} ${r.label}${r.ok || !r.fix ? "" : `\n    → ${r.fix}`}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} problem(s) found.` : "\nSetup looks good.");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
