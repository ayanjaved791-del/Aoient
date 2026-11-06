import { describe, expect, it } from "vitest";
import { PLANS, missingCheckoutConfig, priceFor, yearlySavingPercent } from "@/lib/billing/plans";

describe("plan catalogue", () => {
  it("matches spec §28 monthly prices", () => {
    expect(PLANS.map((p) => [p.id, p.monthlyUsd])).toEqual([["starter", 29], ["growth", 79], ["business", 169]]);
  });
  it("charges 10 months for a year", () => {
    const growth = PLANS.find((p) => p.id === "growth")!;
    expect(priceFor(growth, "yearly")).toEqual({ amount: 790, per: "year" });
    expect(priceFor(growth, "monthly")).toEqual({ amount: 79, per: "month" });
    expect(yearlySavingPercent()).toBe(17);
  });
  it("lists no storage quotas", () => {
    expect(PLANS.flatMap((p) => p.features).join(" ")).not.toMatch(/storage|\bGB\b/i);
  });
  it("names exactly what checkout is missing when Paddle isn't configured", () => {
    expect(missingCheckoutConfig("starter", "yearly")).toEqual([
      "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
      "NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL",
    ]);
  });
});
