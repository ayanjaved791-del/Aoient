import { describe, expect, it } from "vitest";
import { planDatabaseDeploy } from "../../scripts/deploy-db-lib";
import { resolveMigrationUrl } from "@/lib/database-url";

const prod = { VERCEL: "1", VERCEL_ENV: "production" };
const URLS = {
  POSTGRES_URL: "postgres://u:p@pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x",
  POSTGRES_URL_NON_POOLING: "postgres://u:p@pooler.supabase.com:5432/postgres?sslmode=require&supa=base-pooler.x",
};

describe("automatic database updates on deploy", () => {
  it("only production deploys on Vercel change the database", () => {
    expect(planDatabaseDeploy({ ...prod, ...URLS })).toMatchObject({ run: true });
    expect(planDatabaseDeploy({ VERCEL: "1", VERCEL_ENV: "preview", ...URLS })).toMatchObject({ run: false });
    expect(planDatabaseDeploy({ VERCEL: "1", VERCEL_ENV: "development", ...URLS })).toMatchObject({ run: false });
    expect(planDatabaseDeploy({ ...URLS })).toMatchObject({ run: false }); // local npm run build
    expect(planDatabaseDeploy({ ...prod, ...URLS, AOIENT_SKIP_DB_MIGRATIONS: "1" })).toMatchObject({ run: false });
  });

  it("warns (without failing) when no database is configured", () => {
    expect(planDatabaseDeploy(prod)).toMatchObject({ run: false, warn: true });
  });

  it("migrates over the session connection, without Vercel's supa marker", () => {
    const plan = planDatabaseDeploy({ ...prod, ...URLS });
    expect(plan.run && plan.url).toBe("postgres://u:p@pooler.supabase.com:5432/postgres?sslmode=require");
    expect(resolveMigrationUrl({ DATABASE_URL: "postgres://a@h/db", POSTGRES_URL: URLS.POSTGRES_URL })).toBe("postgres://a@h/db");
  });
});
