import { resolveMigrationUrl } from "../src/lib/database-url";

export type DeployDatabasePlan = { run: true; url: string } | { run: false; reason: string; warn?: boolean };

/**
 * Decides whether this build may change the database. Only production builds
 * on Vercel do: preview deployments share the same variables (and so the same
 * database) and must never alter it, and local `npm run build` never does.
 */
export function planDatabaseDeploy(env: Record<string, string | undefined>): DeployDatabasePlan {
  if (env.AOIENT_SKIP_DB_MIGRATIONS === "1") return { run: false, reason: "AOIENT_SKIP_DB_MIGRATIONS=1, skipping database changes." };
  if (env.VERCEL !== "1") return { run: false, reason: "Not a Vercel build; run `npm run db:migrate` yourself when needed." };
  if (env.VERCEL_ENV !== "production") {
    return { run: false, reason: `${env.VERCEL_ENV ?? "unknown"} deployment: the database is only changed by production deploys.` };
  }
  const url = resolveMigrationUrl(env);
  if (!url) {
    return { run: false, warn: true, reason: "No database URL (DATABASE_URL / POSTGRES_URL*) is set, so no database changes were applied." };
  }
  return { run: true, url };
}
