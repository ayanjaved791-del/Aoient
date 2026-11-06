import { describe, expect, it } from "vitest";
import { PLANS, missingCheckoutConfig, priceFor, yearlySavingPercent } from "@/lib/billing/plans";
import { addInterval, licenseState, licenseTimeline } from "@/lib/billing/entitlements";

describe("plan catalogue", () => {
  it("matches spec §28 monthly prices", () => {
    expect(PLANS.map((p) => [p.id, p.monthlyUsd])).toEqual([["medisea", 29], ["indiana", 79], ["pacfic_deepdive", 169]]);
  });
  it("charges 10 months for a year", () => {
    const growth = PLANS.find((p) => p.id === "indiana")!;
    expect(priceFor(growth, "yearly")).toEqual({ amount: 790, per: "year" });
    expect(priceFor(growth, "monthly")).toEqual({ amount: 79, per: "month" });
    expect(yearlySavingPercent()).toBe(17);
  });
  it("uses the product owner's plan names", () => {
    expect(PLANS.map((p) => p.name)).toEqual(["Medisea", "Indiana", "Pacfic-DeepDive"]);
  });
  it("offers every plan both monthly and yearly", () => {
    for (const plan of PLANS) {
      expect(priceFor(plan, "monthly").per).toBe("month");
      expect(priceFor(plan, "yearly")).toEqual({ amount: plan.monthlyUsd * 10, per: "year" });
      expect(missingCheckoutConfig(plan.id, "monthly")).toContain(`NEXT_PUBLIC_PADDLE_PRICE_${plan.id.toUpperCase()}_MONTHLY`);
      expect(missingCheckoutConfig(plan.id, "yearly")).toContain(`NEXT_PUBLIC_PADDLE_PRICE_${plan.id.toUpperCase()}_ANNUAL`);
    }
  });
  it("lists no storage quotas", () => {
    expect(PLANS.flatMap((p) => p.features).join(" ")).not.toMatch(/storage|\bGB\b/i);
  });
  it("names exactly what checkout is missing when Paddle isn't configured", () => {
    expect(missingCheckoutConfig("medisea", "yearly")).toEqual([
      "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
      "NEXT_PUBLIC_PADDLE_PRICE_MEDISEA_ANNUAL",
    ]);
  });
});


describe("license timeline", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  const day = 86_400_000;

  it("a Medisea monthly purchase with Paddle's 14-day trial covers 44 days", () => {
    const trialEndsAt = new Date(now.getTime() + 14 * day);
    const t = licenseTimeline(
      { plan: "medisea", billingInterval: "monthly", status: "trialing", source: "paddle", trialEndsAt, currentPeriodEndsAt: trialEndsAt },
      now,
    );
    expect(t.kind).toBe("paid-trial");
    if (t.kind !== "paid-trial") return;
    expect(t.firstChargeAt).toEqual(trialEndsAt);
    // 14 trial days + one calendar month (30 days from Nov 21 to Dec 21).
    expect(Math.round((t.coveredUntil!.getTime() - now.getTime()) / day)).toBe(44);
  });

  it("tells app trials, paid plans and endings apart", () => {
    const base = { plan: "medisea" as const, billingInterval: "monthly" as const, trialEndsAt: null, currentPeriodEndsAt: new Date(now.getTime() + 5 * day) };
    expect(licenseTimeline({ ...base, status: "trialing", source: "trial", trialEndsAt: new Date(now.getTime() + day) }, now).kind).toBe("app-trial");
    expect(licenseTimeline({ ...base, status: "active", source: "paddle" }, now).kind).toBe("paid");
    expect(licenseTimeline({ ...base, status: "canceled", source: "paddle" }, now).kind).toBe("ending");
    expect(licenseTimeline({ ...base, status: "paused", source: "paddle" }, now).kind).toBe("none");
    expect(licenseState({ ...base, status: "trialing", source: "trial", trialEndsAt: new Date(now.getTime() - 1) }, now)).toBe("expired");
  });

  it("adds calendar months and years", () => {
    expect(addInterval(new Date("2026-01-31T00:00:00Z"), "yearly").toISOString()).toBe("2027-01-31T00:00:00.000Z");
    expect(addInterval(new Date("2026-11-21T00:00:00Z"), "monthly").toISOString()).toBe("2026-12-21T00:00:00.000Z");
  });
});
