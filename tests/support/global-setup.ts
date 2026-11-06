import { readFileSync } from "node:fs";
import { join } from "node:path";
import "dotenv/config";
import postgres from "postgres";
import { applyMigrations } from "../../scripts/migrations-lib";

/**
 * Rebuilds the dedicated test database from supabase/migrations once per run,
 * on top of a minimal stand-in for Supabase's `auth` schema.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    // Unit tests need no database. Integration tests will fail loudly without one.
    console.warn("TEST_DATABASE_URL is not set — integration tests will fail. Unit tests: npm run test:unit");
    return;
  }
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL — tests wipe it.");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;");
  await sql.end();
  await applyMigrations(url, { preamble: readFileSync(join(process.cwd(), "tests/support/auth-stub.sql"), "utf8") });
}
