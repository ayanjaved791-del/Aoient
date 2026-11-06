import { NextResponse } from "next/server";
import { getDb } from "@/server/database/client";
import { resolveDatabaseUrl } from "@/lib/database-url";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * GET /api/health — is the backend wired up? Reports only yes/no facts (never
 * hosts, names or values): whether the database is reachable and which parts
 * of the schema (supabase/setup.sql) are installed.
 */
export async function GET() {
  const body = {
    supabaseAuth: isSupabaseConfigured ? "configured" : "missing settings",
    database: "not configured" as "connected" | "unreachable" | "not configured",
    tables: { accounts: false, organizations: false, permissions: false, licenses: false },
    hint: null as string | null,
  };

  if (resolveDatabaseUrl()) {
    try {
      const sql = getDb();
      const [t] = await sql<{ accounts: boolean; organizations: boolean; permission: boolean; licenses: boolean }[]>`
        select to_regclass('public.profile') is not null as accounts,
               to_regclass('public.organization') is not null as organizations,
               to_regclass('public.permission') is not null as permission,
               to_regclass('public.organization_license') is not null as licenses`;
      const seeded = t.permission ? (await sql<{ n: number }[]>`select count(*)::int as n from public.permission`)[0].n > 0 : false;
      body.database = "connected";
      body.tables = { accounts: t.accounts, organizations: t.organizations, permissions: seeded, licenses: t.licenses };
    } catch {
      body.database = "unreachable";
    }
  }

  const ready = body.database === "connected" && Object.values(body.tables).every(Boolean);
  if (body.database === "not configured") body.hint = "Set DATABASE_URL (or connect Supabase in Vercel, which sets POSTGRES_URL).";
  else if (body.database === "unreachable") body.hint = "The database URL is set but the server can't connect. Check the password and that the Supabase project is running.";
  else if (!ready) body.hint = "Run supabase/setup.sql in the Supabase SQL Editor of the project this site uses.";

  return NextResponse.json({ ok: ready, ...body }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
