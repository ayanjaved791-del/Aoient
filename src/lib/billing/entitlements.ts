/**
 * What each plan includes (the license). Single source of truth for limits;
 * the pricing page's feature lists describe the same numbers.
 *
 * `enforced` limits are checked on the server today. The others belong to
 * modules that aren't released yet; they are shown as part of the plan and
 * will be enforced when those modules ship.
 */
import type { PlanId } from "./plans";

export const TRIAL_DAYS = 14;
export const TRIAL_PLAN: PlanId = "medisea";
const PADDLE_TRIAL_GRACE_MS = 2 * 86_400_000;

export interface PlanEntitlements {
  /** Active members + pending invitations. */
  maxMembers: number;
  /** Active members holding the Owner or Admin role. */
  maxAdminSeats: number;
  /** Creating custom roles (Indiana and above: "Advanced roles & permissions"). */
  customRoles: boolean;
  // Not yet enforced (modules in development):
  maxActiveProjects: number | null; // null = unlimited
  maxAutomations: number;
}

export const ENTITLEMENTS: Record<PlanId, PlanEntitlements> = {
  medisea: { maxMembers: 5, maxAdminSeats: 1, customRoles: false, maxActiveProjects: 10, maxAutomations: 3 },
  indiana: { maxMembers: 15, maxAdminSeats: 3, customRoles: true, maxActiveProjects: null, maxAutomations: 20 },
  pacfic_deepdive: { maxMembers: 40, maxAdminSeats: 10, customRoles: true, maxActiveProjects: null, maxAutomations: 100 },
};

/** System role keys that occupy an admin seat. */
export const ADMIN_SEAT_ROLE_KEYS = ["owner", "admin"] as const;

export type LicenseStatus = "trialing" | "active" | "past_due" | "paused" | "canceled";

export interface LicenseRecord {
  plan: PlanId;
  billingInterval: "monthly" | "yearly" | null;
  status: LicenseStatus;
  source: "trial" | "paddle";
  trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
}

export type LicenseState =
  /** Full access within the plan's limits. */
  | "trial"
  | "active"
  /** Payment failed; Paddle is retrying. Access continues meanwhile. */
  | "past_due"
  /** Canceled but paid until the end of the period. */
  | "canceling"
  /** Trial over, canceled, paused or no license: read-only until a plan is bought. */
  | "expired";

/** Turns the stored license into what the organization may do right now. */
export function licenseState(license: LicenseRecord | null, now: Date = new Date()): LicenseState {
  if (!license) return "expired";
  switch (license.status) {
    case "trialing": {
      // An app trial ends on its date. A Paddle trial converts to active (or
      // fails) by webhook; until then Paddle's own trial date applies.
      if (!license.trialEndsAt) return "trial";
      // Paddle's conversion webhook can arrive a little after the trial date, so
      // a paid trial gets a short grace period; an app trial ends exactly on time.
      const grace = license.source === "paddle" ? PADDLE_TRIAL_GRACE_MS : 0;
      return license.trialEndsAt.getTime() + grace <= now.getTime() ? "expired" : "trial";
    }
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return license.currentPeriodEndsAt && license.currentPeriodEndsAt > now ? "canceling" : "expired";
    case "paused":
      return "expired";
  }
}

/** Expired organizations keep their data and can read it, but can't change it. */
export function isWritable(state: LicenseState): boolean {
  return state !== "expired";
}

export function daysLeft(until: Date | null, now: Date = new Date()): number | null {
  if (!until) return null;
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 86_400_000));
}

/** Adds one billing interval (calendar month or year), as Paddle does. */
export function addInterval(date: Date, interval: "monthly" | "yearly"): Date {
  const d = new Date(date);
  if (interval === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export type LicenseTimeline =
  /** Free app trial (no card). Ends on trialEndsAt unless a plan is bought. */
  | { kind: "app-trial"; trialEndsAt: Date | null }
  /**
   * A bought plan that starts with Paddle's free trial (e.g. Medisea monthly):
   * no charge until firstChargeAt, and that first payment covers one more
   * interval, so access runs until coveredUntil (14 days + 1 month = 44 days).
   */
  | { kind: "paid-trial"; firstChargeAt: Date; coveredUntil: Date | null }
  | { kind: "paid"; renewsAt: Date | null }
  | { kind: "ending"; endsAt: Date | null }
  | { kind: "none" };

export function licenseTimeline(license: LicenseRecord | null, now: Date = new Date()): LicenseTimeline {
  const state = licenseState(license, now);
  if (!license || state === "expired") return { kind: "none" };
  if (license.source === "trial") return { kind: "app-trial", trialEndsAt: license.trialEndsAt };
  if (state === "canceling") return { kind: "ending", endsAt: license.currentPeriodEndsAt };
  if (license.status === "trialing" && license.trialEndsAt) {
    return {
      kind: "paid-trial",
      firstChargeAt: license.trialEndsAt,
      coveredUntil: license.billingInterval ? addInterval(license.trialEndsAt, license.billingInterval) : null,
    };
  }
  return { kind: "paid", renewsAt: license.currentPeriodEndsAt };
}
