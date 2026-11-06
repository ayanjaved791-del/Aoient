/**
 * Runs before `next build` (see package.json "build"). On Vercel production
 * deploys it brings the database up to date — new migrations, then the
 * permission catalogue and system roles — so nobody has to paste setup.sql.
 * If anything fails, the build fails and the previous version stays live.
 */
import postgres from "postgres";
import { applyMigrations } from "./migrations-lib";
import { planDatabaseDeploy } from "./deploy-db-lib";
import { syncPermissionCatalog } from "../src/server/permissions/sync";

async function main() {
  const plan = planDatabaseDeploy(process.env);
  if (!plan.run) {
    (plan.warn ? console.warn : console.log)(`[db] ${plan.reason}`);
    return;
  }
  console.log("[db] Production deploy: updating the database…");
  await applyMigrations(plan.url, { log: true });
  const sql = postgres(plan.url, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  try {
    await syncPermissionCatalog(sql);
    console.log("[db] Permission catalogue and system roles synchronised.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  // Never print the connection string; postgres errors don't include it.
  console.error("[db] Database update failed, stopping the deploy so the live site stays on the previous version.");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
