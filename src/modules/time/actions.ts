"use server";
/**
 * Time server actions: each re-authenticates and re-resolves the workspace
 * from the slug, then the service checks the permission and that the entry or
 * timesheet belongs to this organization (and, for edits, to this person).
 */
import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import { createEntry, deleteEntry, discardTimer, startTimer, stopTimer, updateEntry } from "@/server/time/entries";
import { reviewTimesheet, submitWeek, withdrawWeek } from "@/server/time/timesheets";
import { billProjectHours } from "@/server/time/reports";

async function ctxFor(slug: string) {
  const user = await requireUser();
  return resolveOrgContext(user.id, { slug: String(slug) });
}
const done = <T>(v: T) => { refresh(); return v; };

export async function startTimerAction(slug: string, input: unknown) { return runAction(async () => done(await startTimer(await ctxFor(slug), input))); }
export async function stopTimerAction(slug: string) { return runAction(async () => done(await stopTimer(await ctxFor(slug)))); }
export async function discardTimerAction(slug: string) { return runAction(async () => done(await discardTimer(await ctxFor(slug)))); }
export async function createEntryAction(slug: string, input: unknown) { return runAction(async () => done(await createEntry(await ctxFor(slug), input))); }
export async function updateEntryAction(slug: string, id: string, input: unknown) { return runAction(async () => done(await updateEntry(await ctxFor(slug), String(id), input))); }
export async function deleteEntryAction(slug: string, id: string) { return runAction(async () => done(await deleteEntry(await ctxFor(slug), String(id)))); }
export async function submitWeekAction(slug: string, weekStart: string) { return runAction(async () => done(await submitWeek(await ctxFor(slug), { weekStart }))); }
export async function withdrawWeekAction(slug: string, weekStart: string) { return runAction(async () => done(await withdrawWeek(await ctxFor(slug), { weekStart }))); }
export async function reviewTimesheetAction(slug: string, id: string, input: unknown) { return runAction(async () => done(await reviewTimesheet(await ctxFor(slug), String(id), input))); }
export async function billProjectHoursAction(slug: string, input: unknown) { return runAction(async () => done(await billProjectHours(await ctxFor(slug), input))); }
