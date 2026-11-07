import "server-only";
import { getDb } from "@/server/database/client";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";

export const DASHBOARD_RANGES = [7, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export function parseRange(value: unknown): DashboardRange {
  const n = Number(value);
  return (DASHBOARD_RANGES as readonly number[]).includes(n) ? (n as DashboardRange) : 30;
}

export interface DayPoint {
  /** Calendar day in the organization's time zone, YYYY-MM-DD. */
  day: string;
  value: number;
}

export interface TeamStats {
  activeMembers: number;
  /** Active members whose membership started inside the range. */
  joinedInRange: number;
  /** For each day: current active members who had joined by the end of that day. */
  teamByDay: DayPoint[];
  roles: { name: string; count: number }[];
  invitations: {
    pending: number;
    /** Pending and expiring within 48 hours. */
    expiringSoon: number;
    /** Created inside the range, by what happened to them. */
    sent: number;
    accepted: number;
    expired: number;
    revoked: number;
  };
}

export interface DashboardData {
  range: DashboardRange;
  timezone: string;
  team: TeamStats | null;
  /** Audit events per day; null without audit access. */
  activityByDay: DayPoint[] | null;
}

/** A time zone Postgres accepts; organizations store IANA names, but fall back safely. */
async function safeTimezone(tz: string): Promise<string> {
  const [row] = await getDb()<{ ok: boolean }[]>`select exists (select 1 from pg_timezone_names where name = ${tz}) as ok`;
  return row?.ok ? tz : "UTC";
}

async function loadTeam(ctx: OrgContext, range: DashboardRange, tz: string): Promise<TeamStats> {
  assertPermission(ctx, "organization.members.read");
  const db = getDb();
  const org = ctx.organizationId;
  const [series, roles, [inv], [counts]] = await Promise.all([
    db<{ day: string; value: number }[]>`
      with days as (
        select generate_series((now() at time zone ${tz})::date - (${range}::int - 1), (now() at time zone ${tz})::date, interval '1 day')::date as day
      )
      select to_char(d.day, 'YYYY-MM-DD') as day,
             (select count(*)::int from organization_member m
               where m.organization_id = ${org} and m.status = 'active'
                 and (m.joined_at at time zone ${tz})::date <= d.day) as value
      from days d order by d.day`,
    db<{ name: string; count: number }[]>`
      select r.name, count(*)::int as count
      from organization_member m join role r on r.id = m.role_id
      where m.organization_id = ${org} and m.status = 'active'
      group by r.name order by count desc, r.name`,
    db<{ pending: number; expiring_soon: number; sent: number; accepted: number; expired: number; revoked: number }[]>`
      with recent as (
        select * from invitation
        where organization_id = ${org}
          and (created_at at time zone ${tz})::date > (now() at time zone ${tz})::date - ${range}::int
      )
      select
        (select count(*)::int from invitation where organization_id = ${org} and status = 'pending' and expires_at > now()) as pending,
        (select count(*)::int from invitation where organization_id = ${org} and status = 'pending'
           and expires_at > now() and expires_at <= now() + interval '48 hours') as expiring_soon,
        (select count(*)::int from recent) as sent,
        (select count(*)::int from recent where status = 'accepted') as accepted,
        (select count(*)::int from recent where status = 'expired' or (status = 'pending' and expires_at <= now())) as expired,
        (select count(*)::int from recent where status = 'revoked') as revoked`,
    db<{ active: number; joined: number }[]>`
      select count(*)::int as active,
             count(*) filter (where (joined_at at time zone ${tz})::date > (now() at time zone ${tz})::date - ${range}::int)::int as joined
      from organization_member where organization_id = ${org} and status = 'active'`,
  ]);
  return {
    activeMembers: counts.active,
    joinedInRange: counts.joined,
    teamByDay: series,
    roles,
    invitations: {
      pending: inv.pending, expiringSoon: inv.expiring_soon, sent: inv.sent,
      accepted: inv.accepted, expired: inv.expired, revoked: inv.revoked,
    },
  };
}

async function loadActivity(ctx: OrgContext, range: DashboardRange, tz: string): Promise<DayPoint[]> {
  assertPermission(ctx, "organization.audit.read");
  return getDb()<DayPoint[]>`
    with days as (
      select generate_series((now() at time zone ${tz})::date - (${range}::int - 1), (now() at time zone ${tz})::date, interval '1 day')::date as day
    ),
    events as (
      select (created_at at time zone ${tz})::date as day, count(*)::int as n
      from audit_log
      where organization_id = ${ctx.organizationId}
        and created_at >= now() - make_interval(days => ${range}::int + 1)
      group by 1
    )
    select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(e.n, 0)::int as value
    from days d left join events e on e.day = d.day
    order by d.day`;
}

/**
 * Everything on the dashboard comes from the caller's organization only
 * (`ctx.organizationId` is server-verified), and each block is loaded only
 * when the member's role allows it.
 */
export async function getDashboard(ctx: OrgContext, range: DashboardRange): Promise<DashboardData> {
  const tz = await safeTimezone(ctx.organization.timezone);
  const [team, activityByDay] = await Promise.all([
    can(ctx, "organization.members.read") ? loadTeam(ctx, range, tz) : null,
    can(ctx, "organization.audit.read") ? loadActivity(ctx, range, tz) : null,
  ]);
  return { range, timezone: tz, team, activityByDay };
}
