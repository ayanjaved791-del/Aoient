import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("reports a connected, fully installed database without exposing details", async () => {
    // Integration tests run with DATABASE_URL pointed at the migrated test database.
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      database: "connected",
      tables: { accounts: true, organizations: true, permissions: true, licenses: true },
      hint: null,
    });
    expect(JSON.stringify(body)).not.toMatch(/postgres:|supabase\.co|password/i);
  });
});
