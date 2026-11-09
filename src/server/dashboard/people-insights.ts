import "server-only";
import { getDb } from "@/server/database/client";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import type { LeaveType } from "@/server/people/leave";

/**
 * People numbers for the dashboard, all counted from the organization's own
 * employee and leave records. Only work details are used (department,
 * location, start date, approved leave): never salary, birthdays or other
 * private fields. Days are counted in the organization's time zone.
 */
export interface PeopleInsights {
  departments: { id: string | null; name: string; count: number }[];
  locations: { name: string; count: number }[];
  tenure: { label: string; count: number }[];
  /** Today and the next 6 days: how many people are on approved leave each day. */
  week: { day: string; out: number }[];
  /** Approved leave that is happening now or starts within 14 days. */
  upcomingLeave: { id: string; employeeId: string; name: string; type: LeaveType; start: string; end: string }[];
  /** Work anniversaries today or within 30 days (one year or more). */
  anniversaries: { id: string; name: string; years: number; date: string; inDays: number }[];
  /** People who started in the last 30 days or start within the next 30. */
  newStarters: { id: string; name: string; jobTitle: string | null; start: string; inDays: number }[];
  /** Approved leave days this calendar year, by type. Only for people who approve leave. */
  leaveDaysByType: { type: LeaveType; days: number }[] | null;
}

const TENURE = ["Under 3 months", "3–12 months", "1–2 years", "2+ years"] as const;

export async function getPeopleInsights(ctx: OrgContext): Promise<PeopleInsights> {
  assertPermission(ctx, "people.employee.read");
  const sql = getDb();
  const org = ctx.organizationId;
  const tz = ctx.organization.timezone;
  const today = sql`(now() at time zone ${tz})::date`;

  const [departments, locations, tenure, week, upcoming, anniversaries, starters, leaveTypes] = await Promise.all([
    sql<{ id: string | null; name: string; count: number }[]>`
      select d.id, d.name, count(e.id)::int as count
      from department d
      left join employee e on e.department_id = d.id and e.organization_id = d.organization_id and e.status = 'active'
      where d.organization_id = ${org}
      group by d.id, d.name
      union all
      select null, 'No department', count(*)::int from employee
      where organization_id = ${org} and status = 'active' and department_id is null
      having count(*) > 0
      order by count desc, name`,
    sql<{ name: string; count: number }[]>`
      select coalesce(nullif(trim(location), ''), 'Not set') as name, count(*)::int as count
      from employee where organization_id = ${org} and status = 'active'
      group by 1 order by 2 desc, 1 limit 6`,
    sql<{ bucket: number; count: number }[]>`
      select case
          when start_date > ${today} - interval '3 months' then 0
          when start_date > ${today} - interval '1 year' then 1
          when start_date > ${today} - interval '2 years' then 2
          else 3 end as bucket,
        count(*)::int as count
      from employee where organization_id = ${org} and status = 'active' and start_date is not null and start_date <= ${today}
      group by 1`,
    sql<{ day: string; out: number }[]>`
      select to_char(g.day, 'YYYY-MM-DD') as day,
        (select count(distinct l.employee_id)::int from leave_request l
           join employee e on e.id = l.employee_id and e.organization_id = l.organization_id and e.status = 'active'
           where l.organization_id = ${org} and l.status = 'approved' and g.day between l.start_date and l.end_date) as out
      from generate_series(${today}, ${today} + 6, interval '1 day') as g(day)
      order by g.day`,
    sql<{ id: string; employee_id: string; name: string; type: LeaveType; start: string; end: string }[]>`
      select l.id, e.id as employee_id, e.full_name as name, l.type,
        to_char(l.start_date, 'YYYY-MM-DD') as start, to_char(l.end_date, 'YYYY-MM-DD') as end
      from leave_request l join employee e on e.id = l.employee_id and e.organization_id = l.organization_id
      where l.organization_id = ${org} and l.status = 'approved' and e.status = 'active'
        and l.end_date >= ${today} and l.start_date <= ${today} + 14
      order by l.start_date, lower(e.full_name) limit 6`,
    sql<{ id: string; name: string; years: number; date: string; in_days: number }[]>`
      with a as (
        select e.id, e.full_name as name, e.start_date,
          extract(year from age(${today}, e.start_date))::int as done
        from employee e
        where e.organization_id = ${org} and e.status = 'active' and e.start_date is not null and e.start_date <= ${today} - interval '1 year' + interval '30 days'
      ), n as (
        select id, name,
          case when (start_date + make_interval(years => done))::date = ${today} then done else done + 1 end as years
        from a
      )
      select n.id, n.name, n.years,
        to_char((e.start_date + make_interval(years => n.years))::date, 'YYYY-MM-DD') as date,
        ((e.start_date + make_interval(years => n.years))::date - ${today})::int as in_days
      from n join employee e on e.id = n.id
      where n.years >= 1 and (e.start_date + make_interval(years => n.years))::date between ${today} and ${today} + 30
      order by in_days, lower(n.name) limit 6`,
    sql<{ id: string; name: string; job_title: string | null; start: string; in_days: number }[]>`
      select id, full_name as name, job_title, to_char(start_date, 'YYYY-MM-DD') as start, (start_date - ${today})::int as in_days
      from employee
      where organization_id = ${org} and status = 'active' and start_date between ${today} - 30 and ${today} + 30
      order by start_date desc, lower(full_name) limit 6`,
    can(ctx, "people.leave.approve")
      ? sql<{ type: LeaveType; days: number }[]>`
          select type, coalesce(sum(days), 0)::float as days from leave_request
          where organization_id = ${org} and status = 'approved'
            and start_date >= date_trunc('year', ${today})::date and start_date < (date_trunc('year', ${today}) + interval '1 year')::date
          group by type order by 2 desc`
      : null,
  ]);

  const tenureCounts = TENURE.map((label, i) => ({ label, count: tenure.find((t) => t.bucket === i)?.count ?? 0 }));
  return {
    departments,
    locations,
    tenure: tenureCounts,
    week,
    upcomingLeave: upcoming.map((u) => ({ id: u.id, employeeId: u.employee_id, name: u.name, type: u.type, start: u.start, end: u.end })),
    anniversaries: anniversaries.map((a) => ({ id: a.id, name: a.name, years: a.years, date: a.date, inDays: a.in_days })),
    newStarters: starters.map((s) => ({ id: s.id, name: s.name, jobTitle: s.job_title, start: s.start, inDays: s.in_days })),
    leaveDaysByType: leaveTypes,
  };
}
