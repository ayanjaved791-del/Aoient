"use server";
/**
 * People server actions. Each re-authenticates, re-resolves the workspace from
 * the slug (membership verified on the server), then calls the service, which
 * checks the permission for that exact operation.
 */
import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import { createEmployee, setEmployeeArchived, updateEmployee } from "@/server/people/employees";
import { createDepartment, deleteDepartment, updateDepartment } from "@/server/people/departments";
import { cancelLeave, decideLeave, requestLeave } from "@/server/people/leave";
import { createEmployeeLogin, resetEmployeePassword } from "@/server/people/accounts";
import { isAppError } from "@/lib/errors";

async function ctxFor(slug: string) {
  const user = await requireUser();
  return resolveOrgContext(user.id, { slug: String(slug) });
}
const done = <T>(v: T) => { refresh(); return v; };

export async function createEmployeeAction(slug: string, input: unknown) {
  return runAction(async () => done(await createEmployee(await ctxFor(slug), input)));
}
export async function updateEmployeeAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateEmployee(await ctxFor(slug), String(id), input)));
}
export async function setEmployeeArchivedAction(slug: string, id: string, archived: boolean) {
  return runAction(async () => done(await setEmployeeArchived(await ctxFor(slug), String(id), archived === true)));
}
export async function createDepartmentAction(slug: string, input: unknown) {
  return runAction(async () => done(await createDepartment(await ctxFor(slug), input)));
}
export async function updateDepartmentAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateDepartment(await ctxFor(slug), String(id), input)));
}
export async function deleteDepartmentAction(slug: string, id: string) {
  return runAction(async () => done(await deleteDepartment(await ctxFor(slug), String(id))));
}
export async function requestLeaveAction(slug: string, input: unknown) {
  return runAction(async () => done(await requestLeave(await ctxFor(slug), input)));
}
export async function decideLeaveAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await decideLeave(await ctxFor(slug), String(id), input)));
}
export async function cancelLeaveAction(slug: string, id: string) {
  return runAction(async () => done(await cancelLeave(await ctxFor(slug), String(id))));
}

export async function createEmployeeLoginAction(slug: string, employeeId: string, input: unknown) {
  return runAction(async () => done(await createEmployeeLogin(await ctxFor(slug), String(employeeId), input)));
}
export async function resetEmployeePasswordAction(slug: string, employeeId: string, input: unknown) {
  return runAction(async () => done(await resetEmployeePassword(await ctxFor(slug), String(employeeId), input)));
}

/** Add employee, and optionally create their login in the same step. The employee is kept even if the login fails. */
export async function createEmployeeWithLoginAction(slug: string, input: unknown, login: unknown) {
  return runAction(async () => {
    const ctx = await ctxFor(slug);
    const { id } = await createEmployee(ctx, input);
    if (!login) return done({ id, login: null as null | { email: string } | { error: string } });
    try {
      const created = await createEmployeeLogin(ctx, id, login);
      return done({ id, login: created as { email: string } | { error: string } });
    } catch (e) {
      // Show our own messages only; internal errors stay in the server log.
      if (!isAppError(e)) console.error("[people] login creation failed", e);
      return done({ id, login: { error: isAppError(e) ? e.message : "The login couldn't be created. Try again from their profile." } });
    }
  });
}
