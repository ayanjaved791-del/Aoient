import "server-only";
import { getDb, type Db } from "@/server/database/client";
import { PlanLimitError } from "@/lib/errors";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import {
  ADMIN_SEAT_ROLE_KEYS,
  ENTITLEMENTS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  isWritable,
  licenseState,
  type LicenseRecord,
  type LicenseState,
  type PlanEntitlements,
} from "@/lib/billing/entitlements";

/**
 * Server-side license checks. Every check reads the license from the database
 * inside the caller's transaction (after the organization row is locked), so
 * limits hold under concurrent requests.
 */

export interface License extends LicenseRecord {
  state: LicenseState;
  entitlements: PlanEntitlements;
  planName: string;
}

export async function loadLicense(q: Db, organizationId: string, now = new Date()): Promise<License | null> {
  const [row] = await q<{
    plan: PlanId; billing_interval: "monthly" | "yearly" | null; status: LicenseRecord["status"]; source: LicenseRecord["source"];
    trial_ends_at: Date | null; current_period_ends_at: Date | null;
  }[]>`
    select plan, billing_interval, status, source, trial_ends_at, current_period_ends_at
    from organization_license where organization_id = ${organizationId}`;
  if (!row) return null;
  const record: LicenseRecord = {
    plan: row.plan,
    billingInterval: row.billing_interval,
    status: row.status,
    source: row.source,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEndsAt: row.current_period_ends_at,
  };
  return {
    ...record,
    state: licenseState(record, now),
    entitlements: ENTITLEMENTS[row.plan],
    planName: PLANS.find((p) => p.id === row.plan)?.name ?? row.plan,
  };
}

/** Called once when an organization is created. */
export async function startTrial(tx: Db, organizationId: string): Promise<void> {
  await tx`
    insert into organization_license (organization_id, plan, status, source, trial_ends_at)
    values (${organizationId}, ${TRIAL_PLAN}, 'trialing', 'trial', now() + make_interval(days => ${TRIAL_DAYS}))
    on conflict (organization_id) do nothing`;
}

const EXPIRED_MESSAGE = "Your trial or subscription has ended, so this workspace is read-only. Choose a plan to make changes again.";

/** Changes are blocked when the license has expired (data stays readable). */
export async function assertWritable(tx: Db, organizationId: string): Promise<License> {
  const license = await loadLicense(tx, organizationId);
  if (!license || !isWritable(license.state)) throw new PlanLimitError(EXPIRED_MESSAGE);
  return license;
}

export interface Usage {
  activeMembers: number;
  pendingInvitations: number;
  adminSeats: number;
  customRoles: number;
}

export async function loadUsage(q: Db, organizationId: string): Promise<Usage> {
  const [u] = await q<Usage[]>`
    select
      (select count(*)::int from organization_member where organization_id = ${organizationId} and status = 'active') as "activeMembers",
      (select count(*)::int from invitation where organization_id = ${organizationId} and status = 'pending' and expires_at > now()) as "pendingInvitations",
      (select count(*)::int from organization_member m join role r on r.id = m.role_id
        where m.organization_id = ${organizationId} and m.status = 'active'
          and r.organization_id is null and r.key = any(${[...ADMIN_SEAT_ROLE_KEYS]}::text[])) as "adminSeats",
      (select count(*)::int from role where organization_id = ${organizationId} and not is_system) as "customRoles"`;
  return u;
}

export function occupiesAdminSeat(role: { key: string; isSystem: boolean }): boolean {
  return role.isSystem && (ADMIN_SEAT_ROLE_KEYS as readonly string[]).includes(role.key);
}

function upgradeHint(license: License) {
  return license.state === "trial" ? "Choose a plan" : "Upgrade your plan";
}

/**
 * Seats: active members plus pending invitations may not exceed the plan.
 * `extra` is how many seats the action adds.
 */
export async function assertMemberSeat(tx: Db, organizationId: string, license: License, opts: { countPending: boolean } = { countPending: true }) {
  const usage = await loadUsage(tx, organizationId);
  const used = usage.activeMembers + (opts.countPending ? usage.pendingInvitations : 0);
  const max = license.entitlements.maxMembers;
  if (used + 1 > max) {
    throw new PlanLimitError(
      `The ${license.planName} plan includes up to ${max} users (members and pending invitations). ${upgradeHint(license)} to add more.`,
    );
  }
}

/** Owner/Admin seats, counting pending admin invitations as taken. */
export async function assertAdminSeat(tx: Db, organizationId: string, license: License) {
  const usage = await loadUsage(tx, organizationId);
  const [{ n: pendingAdmins }] = await tx<{ n: number }[]>`
    select count(*)::int as n from invitation i join role r on r.id = i.role_id
    where i.organization_id = ${organizationId} and i.status = 'pending' and i.expires_at > now()
      and r.organization_id is null and r.key = any(${[...ADMIN_SEAT_ROLE_KEYS]}::text[])`;
  const max = license.entitlements.maxAdminSeats;
  if (usage.adminSeats + pendingAdmins + 1 > max) {
    throw new PlanLimitError(
      `The ${license.planName} plan includes ${max} admin seat${max === 1 ? "" : "s"} (Owner or Admin). ${upgradeHint(license)} for more.`,
    );
  }
}

export function assertCustomRoles(license: License) {
  if (!license.entitlements.customRoles) {
    throw new PlanLimitError(`Custom roles aren't included in the ${license.planName} plan. Upgrade to Indiana or above to create them.`);
  }
}

/** For pages: license + usage, or null when the organization has no license row. */
export async function getLicenseOverview(organizationId: string) {
  const db = getDb();
  const [license, usage] = await Promise.all([loadLicense(db, organizationId), loadUsage(db, organizationId)]);
  return { license, usage };
}

export interface BillableOrganization {
  id: string;
  name: string;
  slug: string;
}

/** Organizations where the user is an active member whose role includes billing.manage. */
export async function listBillableOrganizations(userId: string): Promise<BillableOrganization[]> {
  return getDb()<BillableOrganization[]>`
    select o.id, o.name, o.slug
    from organization_member m
    join organization o on o.id = m.organization_id
    join role_permission rp on rp.role_id = m.role_id
    join permission p on p.id = rp.permission_id
    where m.user_id = ${userId} and m.status = 'active' and o.status = 'active' and p.key = 'billing.manage'
    order by m.joined_at asc`;
}

/** A paid subscription that is still running (so a second checkout would double-bill). */
export function hasLivePaidSubscription(license: License | null): boolean {
  return Boolean(license && license.source === "paddle" && license.state !== "expired");
}
