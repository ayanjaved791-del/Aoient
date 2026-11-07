import "server-only";
import { getDb, transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { isUniqueViolation } from "@/server/database/errors";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { employeeBasicSchema, employeeSensitiveSchema } from "@/lib/validation/people";

export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";

export interface EmployeeListRow {
  id: string;
  fullName: string;
  workEmail: string | null;
  jobTitle: string | null;
  department: { id: string; name: string } | null;
  manager: { id: string; name: string } | null;
  employmentType: EmploymentType;
  location: string | null;
  status: "active" | "archived";
  startDate: string | null;
  hasAccount: boolean;
  onLeaveToday: boolean;
}

export interface EmployeeSensitive {
  dateOfBirth: string | null;
  personalEmail: string | null;
  homeAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  salaryAmount: number | null;
  salaryCurrency: string | null;
  salaryPeriod: "hourly" | "monthly" | "yearly" | null;
}

export interface EmployeeDetail extends EmployeeListRow {
  phone: string | null;
  employeeCode: string | null;
  memberId: string | null;
  isSelf: boolean;
  reports: { id: string; name: string; jobTitle: string | null }[];
  /** Null when the viewer may not see private details. */
  sensitive: EmployeeSensitive | null;
  createdAt: Date;
  archivedAt: Date | null;
}

const BASE_SELECT = (db: Db, ctx: OrgContext) => db`
  select e.id, e.full_name, e.work_email, e.job_title, e.employment_type, e.location, e.status,
         to_char(e.start_date, 'YYYY-MM-DD') as start_date, e.member_id, e.phone, e.employee_code, e.created_at, e.archived_at,
         d.id as dept_id, d.name as dept_name, m.id as mgr_id, m.full_name as mgr_name,
         exists (select 1 from leave_request l where l.employee_id = e.id and l.status = 'approved'
                 and (now() at time zone ${ctx.organization.timezone})::date between l.start_date and l.end_date) as on_leave
  from employee e
  left join department d on d.id = e.department_id and d.organization_id = e.organization_id
  left join employee m on m.id = e.manager_id and m.organization_id = e.organization_id`;

type BaseRow = {
  id: string; full_name: string; work_email: string | null; job_title: string | null; employment_type: EmploymentType; location: string | null;
  status: "active" | "archived"; start_date: string | null; member_id: string | null; phone: string | null; employee_code: string | null;
  created_at: Date; archived_at: Date | null; dept_id: string | null; dept_name: string | null; mgr_id: string | null; mgr_name: string | null; on_leave: boolean;
};

const toListRow = (r: BaseRow): EmployeeListRow => ({
  id: r.id, fullName: r.full_name, workEmail: r.work_email, jobTitle: r.job_title,
  department: r.dept_id ? { id: r.dept_id, name: r.dept_name! } : null,
  manager: r.mgr_id ? { id: r.mgr_id, name: r.mgr_name! } : null,
  employmentType: r.employment_type, location: r.location, status: r.status, startDate: r.start_date,
  hasAccount: r.member_id !== null, onLeaveToday: r.on_leave,
});

export async function listEmployees(
  ctx: OrgContext,
  opts: { query?: string; departmentId?: string; status?: "active" | "archived" | "all" } = {},
): Promise<EmployeeListRow[]> {
  assertPermission(ctx, "people.employee.read");
  const db = getDb();
  const q = opts.query?.trim();
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const status = opts.status ?? "active";
  const dept = opts.departmentId && isUuid(opts.departmentId) ? opts.departmentId : null;
  const rows = await db<BaseRow[]>`
    ${BASE_SELECT(db, ctx)}
    where e.organization_id = ${ctx.organizationId}
      ${status === "all" ? db`` : db`and e.status = ${status}`}
      ${dept ? db`and e.department_id = ${dept}` : db``}
      ${like ? db`and (e.full_name ilike ${like} or e.work_email ilike ${like} or e.job_title ilike ${like} or e.employee_code ilike ${like})` : db``}
    order by lower(e.full_name)
    limit 500`;
  return rows.map(toListRow);
}

/** The viewer's own employee record, if they have one (linked through their membership). */
export async function getMyEmployeeId(ctx: OrgContext, q: Db = getDb()): Promise<string | null> {
  const [row] = await q<{ id: string }[]>`select id from employee where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId}`;
  return row?.id ?? null;
}

/**
 * One employee. Anyone with people.employee.read sees work details; private
 * details (salary, birthday, contacts) need people.employee.sensitive.read,
 * except that people can always see their own.
 */
export async function getEmployee(ctx: OrgContext, id: string): Promise<EmployeeDetail> {
  if (!isUuid(id)) throw new NotFoundError("Employee not found");
  const db = getDb();
  const [r] = await db<BaseRow[]>`${BASE_SELECT(db, ctx)} where e.organization_id = ${ctx.organizationId} and e.id = ${id}`;
  if (!r) throw new NotFoundError("Employee not found");
  const isSelf = r.member_id !== null && r.member_id === ctx.memberId;
  if (!isSelf) assertPermission(ctx, "people.employee.read");

  const [reports, sensitive] = await Promise.all([
    db<{ id: string; full_name: string; job_title: string | null }[]>`
      select id, full_name, job_title from employee
      where organization_id = ${ctx.organizationId} and manager_id = ${id} and status = 'active' order by lower(full_name)`,
    isSelf || can(ctx, "people.employee.sensitive.read")
      ? db<{ date_of_birth: string | null; personal_email: string | null; home_address: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null; salary_amount: string | null; salary_currency: string | null; salary_period: EmployeeSensitive["salaryPeriod"] }[]>`
          select to_char(date_of_birth, 'YYYY-MM-DD') as date_of_birth, personal_email, home_address, emergency_contact_name, emergency_contact_phone,
                 salary_amount::text, salary_currency, salary_period
          from employee where id = ${id} and organization_id = ${ctx.organizationId}`
      : null,
  ]);
  const s = sensitive?.[0];
  return {
    ...toListRow(r),
    phone: r.phone,
    employeeCode: r.employee_code,
    memberId: r.member_id,
    isSelf,
    reports: reports.map((x) => ({ id: x.id, name: x.full_name, jobTitle: x.job_title })),
    sensitive: s
      ? {
          dateOfBirth: s.date_of_birth, personalEmail: s.personal_email, homeAddress: s.home_address,
          emergencyContactName: s.emergency_contact_name, emergencyContactPhone: s.emergency_contact_phone,
          salaryAmount: s.salary_amount === null ? null : Number(s.salary_amount), salaryCurrency: s.salary_currency, salaryPeriod: s.salary_period,
        }
      : null,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
  };
}

/** Check that ids from the browser point at rows in this organization, and that the reporting line has no loop. */
async function checkReferences(tx: Db, ctx: OrgContext, data: { departmentId: string | null; managerId: string | null; memberId: string | null }, selfId: string | null) {
  if (data.departmentId) {
    if (!isUuid(data.departmentId)) throw new ValidationError("Choose a department", { departmentId: ["Choose a department"] });
    const [d] = await tx`select 1 from department where id = ${data.departmentId} and organization_id = ${ctx.organizationId}`;
    if (!d) throw new ValidationError("Choose a department", { departmentId: ["That department doesn't exist"] });
  }
  if (data.memberId) {
    if (!isUuid(data.memberId)) throw new ValidationError("Choose a member", { memberId: ["Choose a member"] });
    const [m] = await tx`select 1 from organization_member where id = ${data.memberId} and organization_id = ${ctx.organizationId}`;
    if (!m) throw new ValidationError("Choose a member", { memberId: ["That member isn't in this workspace"] });
  }
  if (data.managerId) {
    if (!isUuid(data.managerId)) throw new ValidationError("Choose a manager", { managerId: ["Choose a manager"] });
    if (data.managerId === selfId) throw new ValidationError("Someone can't manage themselves", { managerId: ["Someone can't manage themselves"] });
    const [m] = await tx`select 1 from employee where id = ${data.managerId} and organization_id = ${ctx.organizationId}`;
    if (!m) throw new ValidationError("Choose a manager", { managerId: ["That person isn't in People"] });
    if (selfId) {
      // Walk up from the new manager; reaching this employee would create a loop.
      const [loop] = await tx<{ found: boolean }[]>`
        with recursive chain(id, depth) as (
          select ${data.managerId}::uuid, 0
          union all
          select e.manager_id, c.depth + 1 from employee e join chain c on e.id = c.id
          where e.manager_id is not null and e.organization_id = ${ctx.organizationId} and c.depth < 50
        )
        select exists (select 1 from chain where id = ${selfId}) as found`;
      if (loop?.found) throw new ValidationError("That would make a reporting loop", { managerId: ["That person already reports to this employee"] });
    }
  }
}

function uniqueError(e: unknown): never {
  if (isUniqueViolation(e, "employee_org_email_key")) throw new ConflictError("Someone in People already uses this work email.");
  if (isUniqueViolation(e, "employee_org_code_key")) throw new ConflictError("That employee ID is already used.");
  if (isUniqueViolation(e, "employee_org_member_key")) throw new ConflictError("That member is already linked to another employee record.");
  throw e;
}

export async function createEmployee(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "people.employee.create");
  const basic = parseInput(employeeBasicSchema, input);
  const wantsSensitive = hasSensitiveInput(input);
  if (wantsSensitive) assertPermission(ctx, "people.employee.sensitive.read");
  const s = wantsSensitive ? parseInput(employeeSensitiveSchema, input) : null;
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await checkReferences(tx, ctx, basic, null);
    const [row] = await tx<{ id: string }[]>`
      insert into employee (organization_id, member_id, employee_code, full_name, work_email, phone, job_title, department_id, manager_id,
        employment_type, location, start_date, date_of_birth, personal_email, home_address, emergency_contact_name, emergency_contact_phone,
        salary_amount, salary_currency, salary_period, created_by_id)
      values (${ctx.organizationId}, ${basic.memberId}, ${basic.employeeCode}, ${basic.fullName}, ${basic.workEmail}, ${basic.phone}, ${basic.jobTitle},
        ${basic.departmentId}, ${basic.managerId}, ${basic.employmentType}, ${basic.location}, ${basic.startDate},
        ${s?.dateOfBirth ?? null}, ${s?.personalEmail ?? null}, ${s?.homeAddress ?? null}, ${s?.emergencyContactName ?? null}, ${s?.emergencyContactPhone ?? null},
        ${s?.salaryAmount ?? null}, ${s?.salaryCurrency ?? null}, ${s?.salaryPeriod ?? null}, ${ctx.userId})
      returning id`;
    // The audit log never stores private values, only that the record exists.
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.employee_created", targetType: "employee", targetId: row.id, metadata: { name: basic.fullName } });
    return row;
  }).catch(uniqueError);
}

const SENSITIVE_KEYS = ["dateOfBirth", "personalEmail", "homeAddress", "emergencyContactName", "emergencyContactPhone", "salaryAmount", "salaryCurrency", "salaryPeriod"] as const;
function hasSensitiveInput(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  return SENSITIVE_KEYS.some((k) => k in input && (input as Record<string, unknown>)[k] !== undefined);
}

export async function updateEmployee(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "people.employee.update");
  if (!isUuid(id)) throw new NotFoundError("Employee not found");
  const basic = parseInput(employeeBasicSchema, input);
  const wantsSensitive = hasSensitiveInput(input);
  if (wantsSensitive) assertPermission(ctx, "people.employee.sensitive.read");
  const s = wantsSensitive ? parseInput(employeeSensitiveSchema, input) : null;
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [before] = await tx<Record<string, unknown>[]>`
      select full_name, work_email, phone, job_title, employee_code, department_id, manager_id, member_id, employment_type, location,
             to_char(start_date, 'YYYY-MM-DD') as start_date
      from employee where id = ${id} and organization_id = ${ctx.organizationId} for update`;
    if (!before) throw new NotFoundError("Employee not found");
    await checkReferences(tx, ctx, basic, id);
    await tx`
      update employee set full_name = ${basic.fullName}, work_email = ${basic.workEmail}, phone = ${basic.phone}, job_title = ${basic.jobTitle},
        employee_code = ${basic.employeeCode}, department_id = ${basic.departmentId}, manager_id = ${basic.managerId}, member_id = ${basic.memberId},
        employment_type = ${basic.employmentType}, location = ${basic.location}, start_date = ${basic.startDate}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    if (s) {
      await tx`
        update employee set date_of_birth = ${s.dateOfBirth}, personal_email = ${s.personalEmail}, home_address = ${s.homeAddress},
          emergency_contact_name = ${s.emergencyContactName}, emergency_contact_phone = ${s.emergencyContactPhone},
          salary_amount = ${s.salaryAmount}, salary_currency = ${s.salaryCurrency}, salary_period = ${s.salaryPeriod}
        where id = ${id} and organization_id = ${ctx.organizationId}`;
    }
    const after: Record<string, unknown> = {
      full_name: basic.fullName, work_email: basic.workEmail, phone: basic.phone, job_title: basic.jobTitle, employee_code: basic.employeeCode,
      department_id: basic.departmentId, manager_id: basic.managerId, member_id: basic.memberId, employment_type: basic.employmentType,
      location: basic.location, start_date: basic.startDate,
    };
    const changed = Object.keys(after).filter((k) => (before[k] ?? null) !== (after[k] ?? null)).map((k) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/Id$/, ""));
    if (s) changed.push("private details");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.employee_updated", targetType: "employee", targetId: id, metadata: { name: basic.fullName, fields: changed } });
  }).catch(uniqueError);
}

export async function setEmployeeArchived(ctx: OrgContext, id: string, archived: boolean): Promise<void> {
  assertPermission(ctx, "people.employee.archive");
  if (!isUuid(id)) throw new NotFoundError("Employee not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ full_name: string; member_id: string | null }[]>`
      update employee set status = ${archived ? "archived" : "active"}, archived_at = ${archived ? new Date() : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}
      returning full_name, member_id`;
    if (!row) throw new NotFoundError("Employee not found");
    if (archived && row.member_id === ctx.memberId) throw new ForbiddenError("You can't archive your own record.");
    if (archived) {
      // Archived people drop out of reporting lines and department heads.
      await tx`update employee set manager_id = null where manager_id = ${id} and organization_id = ${ctx.organizationId}`;
      await tx`update department set head_employee_id = null where head_employee_id = ${id} and organization_id = ${ctx.organizationId}`;
      await tx`update leave_request set status = 'cancelled', updated_at = now() where employee_id = ${id} and status = 'pending'`;
    }
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: archived ? "people.employee_archived" : "people.employee_restored", targetType: "employee", targetId: id, metadata: { name: row.full_name } });
  });
}

/** Workspace members not yet linked to an employee record (for "link to account"). */
export async function listUnlinkedMembers(ctx: OrgContext, includeEmployeeId?: string): Promise<{ id: string; name: string; email: string }[]> {
  assertPermission(ctx, "people.employee.create");
  const keep = includeEmployeeId && isUuid(includeEmployeeId) ? includeEmployeeId : null;
  return getDb()<{ id: string; name: string; email: string }[]>`
    select m.id, coalesce(nullif(p.name, ''), p.email) as name, p.email
    from organization_member m join profile p on p.id = m.user_id
    where m.organization_id = ${ctx.organizationId}
      and not exists (select 1 from employee e where e.member_id = m.id and e.organization_id = m.organization_id ${keep ? getDb()`and e.id <> ${keep}` : getDb()``})
    order by lower(p.name)`;
}

export interface PeopleStats {
  headcount: number;
  departments: number;
  onLeaveToday: number;
  pendingLeave: number | null;
  joinedThisMonth: number;
  byType: { type: EmploymentType; count: number }[];
}

export async function getPeopleStats(ctx: OrgContext): Promise<PeopleStats> {
  assertPermission(ctx, "people.employee.read");
  const tz = ctx.organization.timezone;
  const [[row], types] = await Promise.all([
    getDb()<{ headcount: number; departments: number; on_leave: number; pending: number; joined: number }[]>`
      select
        (select count(*)::int from employee where organization_id = ${ctx.organizationId} and status = 'active') as headcount,
        (select count(*)::int from department where organization_id = ${ctx.organizationId}) as departments,
        (select count(distinct l.employee_id)::int from leave_request l join employee e on e.id = l.employee_id
           where l.organization_id = ${ctx.organizationId} and e.status = 'active' and l.status = 'approved'
             and (now() at time zone ${tz})::date between l.start_date and l.end_date) as on_leave,
        (select count(*)::int from leave_request where organization_id = ${ctx.organizationId} and status = 'pending') as pending,
        (select count(*)::int from employee where organization_id = ${ctx.organizationId} and status = 'active'
           and start_date >= date_trunc('month', now() at time zone ${tz})::date) as joined`,
    getDb()<{ type: EmploymentType; count: number }[]>`
      select employment_type as type, count(*)::int as count from employee
      where organization_id = ${ctx.organizationId} and status = 'active' group by 1 order by 2 desc`,
  ]);
  return {
    headcount: row.headcount, departments: row.departments, onLeaveToday: row.on_leave,
    pendingLeave: can(ctx, "people.leave.approve") ? row.pending : null, joinedThisMonth: row.joined, byType: types,
  };
}
