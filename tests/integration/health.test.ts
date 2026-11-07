import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { isSupabaseConfigured } from "@/lib/supabase/config";

describe("GET /api/health", () => {
  it("reports a connected, fully installed database without exposing details", async () => {
    // Integration tests run with DATABASE_URL pointed at the migrated test database.
    const res = await GET();
    const body = await res.json();
    expect(body).toMatchObject({ database: "connected", tables: { accounts: true, organizations: true, permissions: true, licenses: true } });
    // "ok" also requires Supabase Auth settings, which the test environment may not have.
    expect(body.ok).toBe(isSupabaseConfigured);
    expect(res.status).toBe(isSupabaseConfigured ? 200 : 503);
    if (!isSupabaseConfigured) expect(body.hint).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(JSON.stringify(body)).not.toMatch(/postgres:|supabase\.co|password/i);
  });
});
