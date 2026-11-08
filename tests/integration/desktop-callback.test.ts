/** OAuth that started in the desktop app is handed back to the app, never exchanged in the browser. */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchange = vi.fn();
vi.mock("@/server/auth/supabase", () => ({
  getSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession: exchange, signOut: vi.fn() } }),
}));

const { GET } = await import("@/app/auth/callback/route");

describe("/auth/callback from the desktop app", () => {
  it("sends the code to the hand-off page without exchanging it", async () => {
    const res = await GET(new NextRequest("https://aoient.test/auth/callback?code=abc123def456&next=%2Facme&app=desktop"));
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/auth/desktop");
    expect(to.searchParams.get("code")).toBe("abc123def456");
    expect(to.searchParams.get("next")).toBe("/acme");
    expect(exchange).not.toHaveBeenCalled();
  });

  it("reports a cancelled Google sign-in and cleans up next", async () => {
    const res = await GET(new NextRequest("https://aoient.test/auth/callback?error=access_denied&next=%2F%2Fevil.example&app=desktop"));
    const to = new URL(res.headers.get("location")!);
    expect(to.origin).toBe("https://aoient.test");
    expect(to.pathname).toBe("/auth/desktop");
    expect(to.searchParams.get("error")).toBe("1");
    expect(to.searchParams.has("code")).toBe(false);
    expect(to.searchParams.get("next")).toBe("/organizations");
  });
});
