import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "@/lib/database-url";
import { resolveAppUrl } from "@/lib/app-url";
import { buildSetupSql } from "../../scripts/setup-sql-lib";

describe("resolveDatabaseUrl", () => {
  it("prefers DATABASE_URL", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://a@h/db", POSTGRES_URL: "postgres://b@h/db" })).toBe("postgres://a@h/db");
  });
  it("falls back to the Vercel integration's POSTGRES_URL and strips its supa marker", () => {
    const url = resolveDatabaseUrl({ POSTGRES_URL: "postgres://u:p@aws-0.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x" });
    expect(url).toBe("postgres://u:p@aws-0.pooler.supabase.com:6543/postgres?sslmode=require");
  });
  it("is undefined when neither is set", () => {
    expect(resolveDatabaseUrl({})).toBeUndefined();
  });
});

describe("resolveAppUrl", () => {
  it("uses APP_URL without a trailing slash", () => {
    expect(resolveAppUrl({ APP_URL: "https://aoient.com/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://aoient.com");
  });
  it("falls back to the Vercel production domain, then localhost", () => {
    expect(resolveAppUrl({ VERCEL_PROJECT_PRODUCTION_URL: "aoient.vercel.app" })).toBe("https://aoient.vercel.app");
    expect(resolveAppUrl({})).toBe("http://localhost:3000");
  });
});

describe("supabase/setup.sql", () => {
  it("is up to date with the migrations and permission catalogue (run: npm run db:setup-sql)", () => {
    expect(readFileSync(join(process.cwd(), "supabase", "setup.sql"), "utf8")).toBe(buildSetupSql());
  });
});
