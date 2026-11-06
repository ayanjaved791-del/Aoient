/**
 * Plan catalogue from spec §28 (prices and limits are provisional hypotheses).
 * Storage quotas are intentionally excluded (ADR-11).
 *
 * Annual price = 10 monthly payments for 12 months (spec §28 "Pricing assumptions").
 * Paddle price IDs are public identifiers (not secrets) and are read from
 * NEXT_PUBLIC_* variables. They are referenced literally so Next can inline them.
 */

export type PlanId = "starter" | "growth" | "business";
export type BillingInterval = "monthly" | "yearly";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyUsd: number;
  featured?: boolean;
  features: string[];
}

export const ANNUAL_MONTHS_CHARGED = 10;

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For small teams getting organised.",
    monthlyUsd: 29,
    features: [
      "Up to 5 users · 1 admin seat",
      "10 active projects",
      "People, CRM & Projects (basic)",
      "Time tracking",
      "Basic analytics",
      "3 automations",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing agencies and studios.",
    monthlyUsd: 79,
    featured: true,
    features: [
      "Up to 15 users · 3 admin seats",
      "Unlimited projects",
      "Advanced People, CRM & Projects",
      "Timesheet approvals & billable time",
      "Custom dashboards",
      "20 automations",
      "Advanced roles & permissions",
      "Priority support",
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "For established teams that need control.",
    monthlyUsd: 169,
    features: [
      "Up to 40 users · 10 admin seats",
      "Unlimited projects",
      "Advanced modules with controls",
      "Utilization reporting",
      "Cross-module analytics",
      "100 automations",
      "Custom roles & selected security controls",
      "Premium support",
    ],
  },
];

export function priceFor(plan: Plan, interval: BillingInterval): { amount: number; per: "month" | "year" } {
  return interval === "monthly"
    ? { amount: plan.monthlyUsd, per: "month" }
    : { amount: plan.monthlyUsd * ANNUAL_MONTHS_CHARGED, per: "year" };
}

/** Whole-percent saving of yearly vs paying monthly for 12 months. */
export function yearlySavingPercent(): number {
  return Math.round((1 - ANNUAL_MONTHS_CHARGED / 12) * 100);
}

const PRICE_IDS: Record<PlanId, Record<BillingInterval, string | undefined>> = {
  starter: {
    monthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL,
  },
  growth: {
    monthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL,
  },
  business: {
    monthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_ANNUAL,
  },
};

export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || undefined;
export const PADDLE_ENVIRONMENT: "sandbox" | "production" =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";

export function paddlePriceId(plan: PlanId, interval: BillingInterval): string | undefined {
  return PRICE_IDS[plan][interval] || undefined;
}

/** Names of the public settings checkout still needs for this plan/interval (empty = ready). */
export function missingCheckoutConfig(plan: PlanId, interval: BillingInterval): string[] {
  const missing: string[] = [];
  if (!PADDLE_CLIENT_TOKEN) missing.push("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
  if (!paddlePriceId(plan, interval)) {
    missing.push(`NEXT_PUBLIC_PADDLE_PRICE_${plan.toUpperCase()}_${interval === "monthly" ? "MONTHLY" : "ANNUAL"}`);
  }
  return missing;
}
