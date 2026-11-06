/** `npm run db:setup-sql` — regenerates supabase/setup.sql (see setup-sql-lib.ts). */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSetupSql } from "./setup-sql-lib";

writeFileSync(join(process.cwd(), "supabase", "setup.sql"), buildSetupSql());
console.log("✔ Wrote supabase/setup.sql");
