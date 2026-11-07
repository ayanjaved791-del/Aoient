import "server-only";
import { getDb, transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { isUniqueViolation } from "@/server/database/errors";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { departmentSchema } from "@/lib/validation/people";

export interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
  head: { id: string; name: string } | null;
  employeeCount: number;
}

export async function listDepartments(ctx: OrgContext): Promise<DepartmentRow[]> {
  assertPermission(ctx, "people.employee.read");
  const rows = await getDb()<{ id: string; name: string; description: string | null; head_id: string | null; head_name: string | null; n: number }[]>`
    select d.id, d.name, d.description, h.id as head_id, h.full_name as head_name,
           (select count(*)::int from employee e where e.department_id = d.id and e.status = 'active') as n
    from department d
    left join employee h on h.id = d.head_employee_id and h.organization_id = d.organization_id
    where d.organization_id = ${ctx.organizationId}
    order by lower(d.name)`;
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, head: r.head_id ? { id: r.head_id, name: r.head_name! } : null, employeeCount: r.n }));
}

/** An employee id from the browser is only accepted if it belongs to this organization. */
async function assertOwnEmployee(tx: Db, organizationId: string, employeeId: string | null) {
  if (!employeeId) return;
  if (!isUuid(employeeId)) throw new NotFoundError("Employee not found");
  const [row] = await tx`select 1 from employee where id = ${employeeId} and organization_id = ${organizationId}`;
  if (!row) throw new NotFoundError("Employee not found");
}

export async function createDepartment(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "people.department.manage");
  const data = parseInput(departmentSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertOwnEmployee(tx, ctx.organizationId, data.headEmployeeId);
    const [row] = await tx<{ id: string }[]>`
      insert into department (organization_id, name, description, head_employee_id)
      values (${ctx.organizationId}, ${data.name}, ${data.description}, ${data.headEmployeeId})
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.department_created", targetType: "department", targetId: row.id, metadata: { name: data.name } });
    return row;
  }).catch((e) => {
    if (isUniqueViolation(e)) throw new ConflictError("A department with this name already exists.");
    throw e;
  });
}

export async function updateDepartment(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "people.department.manage");
  if (!isUuid(id)) throw new NotFoundError("Department not found");
  const data = parseInput(departmentSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertOwnEmployee(tx, ctx.organizationId, data.headEmployeeId);
    const res = await tx`
      update department set name = ${data.name}, description = ${data.description}, head_employee_id = ${data.headEmployeeId}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    if (res.count === 0) throw new NotFoundError("Department not found");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.department_updated", targetType: "department", targetId: id, metadata: { name: data.name } });
  }).catch((e) => {
    if (isUniqueViolation(e)) throw new ConflictError("A department with this name already exists.");
    throw e;
  });
}

/** Employees in a deleted department simply have no department afterwards. */
export async function deleteDepartment(ctx: OrgContext, id: string): Promise<void> {
  assertPermission(ctx, "people.department.manage");
  if (!isUuid(id)) throw new NotFoundError("Department not found");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ name: string }[]>`delete from department where id = ${id} and organization_id = ${ctx.organizationId} returning name`;
    if (!row) throw new NotFoundError("Department not found");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "people.department_deleted", targetType: "department", targetId: id, metadata: { name: row.name } });
  });
}
