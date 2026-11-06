import { describe, expect, it } from "vitest";
import { createInvitationSchema, createOrganizationSchema, slugify, slugSchema } from "@/lib/validation/organization";
import { generateToken, hashToken } from "@/lib/tokens";

describe("organization validation", () => {
  it("normalises and validates slugs", () => {
    expect(slugSchema.parse("  Acme-Studio ")).toBe("acme-studio");
    for (const bad of ["ab", "acme--studio", "-acme", "acme_studio", "settings", "api", "a".repeat(49)]) {
      expect(slugSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
  it("slugify produces a valid slug from names", () => {
    expect(slugify("Ács & Partners, Ltd.")).toBe("acs-partners-ltd");
  });
  it("validates timezone and currency", () => {
    expect(createOrganizationSchema.safeParse({ name: "Acme", slug: "acme", timezone: "Mars/Olympus" }).success).toBe(false);
    expect(createOrganizationSchema.safeParse({ name: "Acme", slug: "acme", currency: "usd" }).data?.currency).toBe("USD");
    expect(createOrganizationSchema.safeParse({ name: "Acme", slug: "acme", currency: "US" }).success).toBe(false);
  });
  it("lowercases invitation emails and requires a uuid role", () => {
    const r = createInvitationSchema.safeParse({ email: " Jane@Example.COM ", roleId: "0190a8b4-7c3e-7000-8000-000000000000" });
    expect(r.success && r.data.email).toBe("jane@example.com");
    expect(createInvitationSchema.safeParse({ email: "jane@example.com", roleId: "owner" }).success).toBe(false);
  });
});

describe("tokens", () => {
  it("generates high-entropy unique tokens and stable hashes", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toContain(a);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
