/**
 * `npm run db:seed` — reference data only (permission catalogue + system roles).
 * It never creates business records.
 */
import "dotenv/config";
import postgres from "postgres";
import { resolveDatabaseUrl } from "../src/lib/database-url";
import { syncPermissionCatalog } from "../src/server/permissions/sync";

async function main() {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL (or POSTGRES_URL) is not set. See .env.example.");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await syncPermissionCatalog(sql);
    console.log("✔ Permission catalogue and system roles synchronised");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
