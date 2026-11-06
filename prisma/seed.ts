/**
 * Seed = reference data only (permission catalogue + system roles).
 * It never creates business records; demo data, if added later, must live in a
 * separate, explicitly-labelled script that refuses to run in production.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncPermissionCatalog } from "../src/server/permissions/sync";

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    await syncPermissionCatalog(db);
    console.log("✔ Permission catalogue and system roles synchronised");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
