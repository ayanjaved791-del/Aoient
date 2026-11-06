import { describe, expect, it } from "vitest";
import { PLANS, missingCheckoutConfig, priceFor, yearlySavingPercent } from "@/lib/billing/plans";

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
