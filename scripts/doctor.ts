/**
 * `npm run doctor` — checks the local setup and explains what to fix.
 * Prints variable NAMES only, never values.
 */
import "dotenv/config";
import pg from "pg";

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

  check(validUrl(env.APP_URL), "APP_URL is a full URL", "Set APP_URL in .env, e.g. http://localhost:3000 — the exact address you open in the browser.");
  check(
    !env.BETTER_AUTH_URL || env.BETTER_AUTH_URL === env.APP_URL,
    "BETTER_AUTH_URL matches APP_URL",
    "Set BETTER_AUTH_URL to the same value as APP_URL.",
  );
  check(
    (env.BETTER_AUTH_SECRET ?? "").length >= 32,
    "BETTER_AUTH_SECRET is at least 32 characters",
    "Generate one with: openssl rand -base64 32",
  );
  check(Boolean(env.DATABASE_URL), "DATABASE_URL is set", "Set DATABASE_URL, e.g. postgresql://user:pass@localhost:5432/aoient_dev");

  if (env.DATABASE_URL) {
    const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    let connected = false;
    try {
      await client.connect();
      connected = true;
      check(true, "Database is reachable");
    } catch (e) {
      check(false, "Database is reachable", `Could not connect (${(e as Error).message}). Start PostgreSQL and check the host, port, user, password and database name in DATABASE_URL.`);
    }

    if (connected) {
      const tables = await client.query<{ name: string }>(
        `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('user','session','organization','role','permission')`,
      );
      check(tables.rowCount === 5, "Database tables exist (migrations applied)", "Run: npm run db:deploy  (or npm run db:migrate in development)");

      if (tables.rowCount === 5) {
        const roles = await client.query(`SELECT 1 FROM role WHERE "isSystem" = true AND key = 'owner'`);
        check((roles.rowCount ?? 0) > 0, "System roles are seeded", "Run: npm run db:seed  (needed before anyone can create an organization)");
      }
      await client.end();
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
