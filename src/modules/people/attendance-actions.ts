"use server";
/**
 * Attendance server actions. Each re-authenticates and re-resolves the
 * workspace from the slug (membership verified on the server); the service
 * checks the permission and that every employee id belongs to that workspace.
 */
import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import { checkIn, checkOut, clearAttendance, correctAttendance, saveAttendanceSetting } from "@/server/people/attendance";

async function ctxFor(slug: string) {
  const user = await requireUser();
  return resolveOrgContext(user.id, { slug: String(slug) });
}
const done = <T>(v: T) => { refresh(); return v; };

export async function checkInAction(slug: string, input: unknown) {
  return runAction(async () => done(await checkIn(await ctxFor(slug), input)));
}
export async function checkOutAction(slug: string, input: unknown) {
  return runAction(async () => done(await checkOut(await ctxFor(slug), input)));
}
export async function correctAttendanceAction(slug: string, input: unknown) {
  return runAction(async () => done(await correctAttendance(await ctxFor(slug), input)));
}
export async function clearAttendanceAction(slug: string, id: string) {
  return runAction(async () => done(await clearAttendance(await ctxFor(slug), String(id))));
}
export async function saveAttendanceSettingAction(slug: string, input: unknown) {
  return runAction(async () => done(await saveAttendanceSetting(await ctxFor(slug), input)));
}
