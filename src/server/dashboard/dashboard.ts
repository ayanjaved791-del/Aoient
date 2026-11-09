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
  suspendedMembers: number;
  /** Active Owners and Admins. */
  adminMembers: number;
  /** Same measure for the period right before the range, for comparison. */
  joinedPrevRange: number;
  sentPrevRange: number;
  /** Median hours from invitation to acceptance, for invitations accepted in the range. */
  medianAcceptHours: number | null;
  recentlyJoined: { id: string; name: string; email: string; roleName: string; joinedAt: Date }[];
  expiringInvites: { id: string; email: string; roleName: string; expiresAt: Date }[];
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

export interface ActivityStats {
  byDay: DayPoint[];
  total: number;
  totalPrevRange: number;
  /** [weekday 0=Mon..6=Sun][hour 0..23] event counts in the organization's time zone. */
  heatmap: number[][];
  byArea: { area: "Team" | "Roles & access" | "Organization" | "Billing" | "People" | "Sales"; count: number }[];
  topPeople: { name: string; count: number }[];
}

export interface DashboardData {
  range: DashboardRange;
  timezone: string;
  team: TeamStats | null;
  /** Null without audit access. */
  activity: ActivityStats | null;
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
  const [series, roles, [inv], [counts], recentlyJoined, expiringInvites, [extra]] = await Promise.all([
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
    db<{ active: number; joined: number; suspended: number; admins: number; joined_prev: number }[]>`
      select count(*) filter (where m.status = 'active')::int as active,
             count(*) filter (where m.status = 'active' and (m.joined_at at time zone ${tz})::date > (now() at time zone ${tz})::date - ${range}::int)::int as joined,
             count(*) filter (where m.status = 'active'
               and (m.joined_at at time zone ${tz})::date > (now() at time zone ${tz})::date - ${range * 2}::int
               and (m.joined_at at time zone ${tz})::date <= (now() at time zone ${tz})::date - ${range}::int)::int as joined_prev,
             count(*) filter (where m.status = 'suspended')::int as suspended,
             count(*) filter (where m.status = 'active' and r.organization_id is null and r.key in ('owner', 'admin'))::int as admins
      from organization_member m join role r on r.id = m.role_id
      where m.organization_id = ${org}`,
    db<{ id: string; name: string; email: string; role_name: string; joined_at: Date }[]>`
      select m.id, coalesce(nullif(p.name, ''), p.email) as name, p.email, r.name as role_name, m.joined_at
      from organization_member m join profile p on p.id = m.user_id join role r on r.id = m.role_id
      where m.organization_id = ${org} and m.status = 'active'
      order by m.joined_at desc limit 5`,
    db<{ id: string; email: string; role_name: string; expires_at: Date }[]>`
      select i.id, i.email, r.name as role_name, i.expires_at
      from invitation i join role r on r.id = i.role_id
      where i.organization_id = ${org} and i.status = 'pending' and i.expires_at > now() and i.expires_at <= now() + interval '72 hours'
      order by i.expires_at asc limit 5`,
    db<{ sent_prev: number; median_hours: number | null }[]>`
      select
        (select count(*)::int from invitation where organization_id = ${org}
           and (created_at at time zone ${tz})::date > (now() at time zone ${tz})::date - ${range * 2}::int
           and (created_at at time zone ${tz})::date <= (now() at time zone ${tz})::date - ${range}::int) as sent_prev,
        (select round((percentile_cont(0.5) within group (order by extract(epoch from accepted_at - created_at) / 3600))::numeric, 1)::float8
           from invitation where organization_id = ${org} and status = 'accepted' and accepted_at is not null
             and accepted_at >= now() - make_interval(days => ${range}::int)) as median_hours`,
  ]);
  return {
    activeMembers: counts.active,
    suspendedMembers: counts.suspended,
    adminMembers: counts.admins,
    joinedPrevRange: counts.joined_prev,
    sentPrevRange: extra.sent_prev,
    medianAcceptHours: extra.median_hours,
    recentlyJoined: recentlyJoined.map((m) => ({ id: m.id, name: m.name, email: m.email, roleName: m.role_name, joinedAt: m.joined_at })),
    expiringInvites: expiringInvites.map((i) => ({ id: i.id, email: i.email, roleName: i.role_name, expiresAt: i.expires_at })),
    joinedInRange: counts.joined,
    teamByDay: series,
    roles,
    invitations: {
      pending: inv.pending, expiringSoon: inv.expiring_soon, sent: inv.sent,
      accepted: inv.accepted, expired: inv.expired, revoked: inv.revoked,
    },
  };
}

const AREA_OF: Record<string, ActivityStats["byArea"][number]["area"]> = { member: "Team", role: "Roles & access", organization: "Organization", billing: "Billing", people: "People", crm: "Sales" };

async function loadActivity(ctx: OrgContext, range: DashboardRange, tz: string): Promise<ActivityStats> {
  assertPermission(ctx, "organization.audit.read");
  const db = getDb();
  const org = ctx.organizationId;
  // Events whose local calendar day falls in the range (or the range before it, for comparison).
  const inRange = (from: number, to: number) => db`
    (a.created_at at time zone ${tz})::date > (now() at time zone ${tz})::date - ${from}::int
    and (a.created_at at time zone ${tz})::date <= (now() at time zone ${tz})::date - ${to}::int`;
  const [byDay, [totals], cells, areas, people] = await Promise.all([
    db<DayPoint[]>`
      with days as (
        select generate_series((now() at time zone ${tz})::date - (${range}::int - 1), (now() at time zone ${tz})::date, interval '1 day')::date as day
      ),
      events as (
        select (a.created_at at time zone ${tz})::date as day, count(*)::int as n
        from audit_log a where a.organization_id = ${org} and ${inRange(range, 0)}
        group by 1
      )
      select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(e.n, 0)::int as value
      from days d left join events e on e.day = d.day order by d.day`,
    db<{ total: number; prev: number }[]>`
      select count(*) filter (where ${inRange(range, 0)})::int as total,
             count(*) filter (where ${inRange(range * 2, range)})::int as prev
      from audit_log a where a.organization_id = ${org}`,
    db<{ dow: number; hour: number; n: number }[]>`
      select (extract(isodow from a.created_at at time zone ${tz})::int - 1) as dow,
             extract(hour from a.created_at at time zone ${tz})::int as hour, count(*)::int as n
      from audit_log a where a.organization_id = ${org} and ${inRange(range, 0)}
      group by 1, 2`,
    db<{ prefix: string; n: number }[]>`
      select split_part(a.action, '.', 1) as prefix, count(*)::int as n
      from audit_log a where a.organization_id = ${org} and ${inRange(range, 0)}
      group by 1`,
    db<{ name: string; n: number }[]>`
      select coalesce(nullif(p.name, ''), case a.source when 'webhook' then 'Paddle' when 'system' then 'Aoient' else 'Someone' end) as name,
             count(*)::int as n
      from audit_log a left join profile p on p.id = a.actor_user_id
      where a.organization_id = ${org} and ${inRange(range, 0)}
      group by 1 order by n desc, name limit 5`,
  ]);
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const c of cells) heatmap[c.dow][c.hour] = c.n;
  const areaCounts = new Map<ActivityStats["byArea"][number]["area"], number>();
  for (const a of areas) {
    const area = AREA_OF[a.prefix] ?? "Organization";
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + a.n);
  }
  return {
    byDay,
    total: totals.total,
    totalPrevRange: totals.prev,
    heatmap,
    byArea: (["Team", "People", "Sales", "Roles & access", "Organization", "Billing"] as const).map((area) => ({ area, count: areaCounts.get(area) ?? 0 })),
    topPeople: people.map((p) => ({ name: p.name, count: p.n })),
  };
}

/**
 * Everything on the dashboard comes from the caller's organization only
 * (`ctx.organizationId` is server-verified), and each block is loaded only
 * when the member's role allows it.
 */
export async function getDashboard(ctx: OrgContext, range: DashboardRange): Promise<DashboardData> {
  const tz = await safeTimezone(ctx.organization.timezone);
  const [team, activity] = await Promise.all([
    can(ctx, "organization.members.read") ? loadTeam(ctx, range, tz) : null,
    can(ctx, "organization.audit.read") ? loadActivity(ctx, range, tz) : null,
  ]);
  return { range, timezone: tz, team, activity };
}
