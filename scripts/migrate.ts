/**
 * `npm run db:migrate` — applies supabase/migrations/*.sql in order to the
 * database in DATABASE_URL (use Supabase's *direct* or *session* connection
 * string). Each file runs once, in a transaction, and is recorded in
 * public.schema_migration. Equivalent to `supabase db push` without the CLI.
 */
import "dotenv/config";
import { applyMigrations } from "./migrations-lib";

const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}
applyMigrations(url, { log: true })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
