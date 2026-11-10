/**
 * Time: timers, manual entries, weekly timesheets with approval, team reports
 * and billing hours to an invoice. People only change their own time, locked
 * weeks stay locked, and no organization sees another's hours.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase } from "../support/db";
import {
  createEntry, deleteEntry, discardTimer, getRunningTimer, listEntries, listTrackableWork, startTimer, stopTimer, updateEntry,
} from "@/server/time/entries";
import { getWeek, listTimesheets, reviewTimesheet, submitWeek, withdrawWeek } from "@/server/time/timesheets";
import { billProjectHours, getTimeReport } from "@/server/time/reports";
import { createProject } from "@/server/projects/projects";
import { createTask } from "@/server/projects/tasks";
import { deleteDocument, getDocument } from "@/server/finance/documents";
import { createCompany } from "@/server/crm/contacts";
import { addDays, weekStartOf } from "@/lib/validation/time";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
const week = () => weekStartOf(today());

describe("time", () => {
  beforeEach(resetDatabase);

  it("runs one timer at a time and saves its minutes", async () => {
    const { org } = await createOrgWithOwner("time-timer");
    const emp = await addMember(org.id, "employee");
    const a = await startTimer(emp.ctx, { description: "Design review" });
    expect(await getRunningTimer(emp.ctx)).toMatchObject({ id: a.id, running: true, description: "Design review" });
    // Pretend it started 25 minutes ago, then start another: the first one stops.
    await db()`update time_entry set started_at = now() - interval '25 minutes' where id = ${a.id}`;
    const b = await startTimer(emp.ctx, { description: "Emails" });
    expect(b.stopped).toEqual({ id: a.id, minutes: 25 });
    await db()`update time_entry set started_at = now() - interval '100 seconds' where id = ${b.id}`;
    expect(await stopTimer(emp.ctx)).toEqual({ id: b.id, minutes: 2 });
    await expect(stopTimer(emp.ctx)).rejects.toMatchObject({ code: "CONFLICT" });
    await startTimer(emp.ctx, {});
    await discardTimer(emp.ctx);
    expect(await getRunningTimer(emp.ctx)).toBeNull();
    expect((await listEntries(emp.ctx, { from: today(), to: today() })).map((e) => e.minutes).sort()).toEqual([2, 25]);
  });

  it("logs manual time, refuses impossible days and the future", async () => {
    const { org } = await createOrgWithOwner("time-manual");
    const emp = await addMember(org.id, "employee");
    const e = await createEntry(emp.ctx, { workDate: today(), duration: "1:30", description: "Client call", billable: true });
    await expect(createEntry(emp.ctx, { workDate: today(), duration: "23h" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createEntry(emp.ctx, { workDate: addDays(today(), 2), duration: "1h" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createEntry(emp.ctx, { workDate: today(), duration: "lots" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await updateEntry(emp.ctx, e.id, { workDate: today(), duration: "2h", description: "Client call", billable: true });
    expect((await listEntries(emp.ctx, { from: today(), to: today() }))[0]).toMatchObject({ minutes: 120, billable: true });
    await deleteEntry(emp.ctx, e.id);
    expect(await listEntries(emp.ctx, { from: today(), to: today() })).toEqual([]);
  });

  it("only lets people change their own time, and only managers see everyone's", async () => {
    const { org } = await createOrgWithOwner("time-own");
    const ali = await addMember(org.id, "employee");
    const sara = await addMember(org.id, "employee");
    const pm = await addMember(org.id, "project_manager");
    const e = await createEntry(ali.ctx, { workDate: today(), duration: "1h" });
    for (const run of [() => updateEntry(sara.ctx, e.id, { workDate: today(), duration: "5h" }), () => deleteEntry(sara.ctx, e.id), () => updateEntry(pm.ctx, e.id, { workDate: today(), duration: "5h" })]) {
      await expect(run()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    await expect(listEntries(sara.ctx, { memberId: ali.member.id, from: today(), to: today() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getWeek(sara.ctx, { weekStart: week(), memberId: ali.member.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await listEntries(pm.ctx, { memberId: ali.member.id, from: today(), to: today() })).toHaveLength(1);
    await expect(getTimeReport(ali.ctx, { from: today(), to: today() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getTimeReport(pm.ctx, { from: today(), to: today() })).total).toBe(60);
    // A guest doesn't track time at all.
    const guest = await addMember(org.id, "guest");
    await expect(createEntry(guest.ctx, { workDate: today(), duration: "1h" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("logs time only on projects the person is on, and tasks of that project", async () => {
    const { org, ctx: owner } = await createOrgWithOwner("time-proj");
    const emp = await addMember(org.id, "employee");
    const mine = await createProject(owner, { name: "Mine", memberIds: [emp.member.id] });
    const other = await createProject(owner, { name: "Not mine" });
    const task = await createTask(owner, mine.id, { title: "Homepage" });
    const otherTask = await createTask(owner, other.id, { title: "Secret" });
    expect((await listTrackableWork(emp.ctx)).map((p) => p.name)).toEqual(["Mine"]);
    await createEntry(emp.ctx, { workDate: today(), duration: "1h", projectId: mine.id, taskId: task.id });
    await expect(createEntry(emp.ctx, { workDate: today(), duration: "1h", projectId: other.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createEntry(emp.ctx, { workDate: today(), duration: "1h", projectId: mine.id, taskId: otherTask.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(startTimer(emp.ctx, { taskId: task.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("locks a submitted week, and approval goes to someone else", async () => {
    const { org, ctx: owner } = await createOrgWithOwner("time-week");
    const emp = await addMember(org.id, "employee");
    const pm = await addMember(org.id, "project_manager");
    await expect(submitWeek(emp.ctx, { weekStart: week() })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const e = await createEntry(emp.ctx, { workDate: today(), duration: "3h" });
    await expect(submitWeek(emp.ctx, { weekStart: today() === week() ? addDays(week(), 1) : today() })).rejects.toMatchObject({ code: "VALIDATION_ERROR" }); // not a Monday
    await submitWeek(emp.ctx, { weekStart: week() });
    expect(await getWeek(emp.ctx, { weekStart: week() })).toMatchObject({ status: "submitted", total: 180 });
    await expect(updateEntry(emp.ctx, e.id, { workDate: today(), duration: "1h" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createEntry(emp.ctx, { workDate: today(), duration: "1h" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(startTimer(emp.ctx, {})).rejects.toMatchObject({ code: "CONFLICT" });
    // Withdraw, change, submit again.
    await withdrawWeek(emp.ctx, { weekStart: week() });
    await updateEntry(emp.ctx, e.id, { workDate: today(), duration: "4h" });
    await submitWeek(emp.ctx, { weekStart: week() });
    const [ts] = await listTimesheets(pm.ctx, { status: "submitted" });
    expect(ts).toMatchObject({ member: { id: emp.member.id }, total: 240, canReview: true });
    await expect(reviewTimesheet(emp.ctx, ts.id, { decision: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await reviewTimesheet(pm.ctx, ts.id, { decision: "reject", note: "Add the project" });
    await updateEntry(emp.ctx, e.id, { workDate: today(), duration: "4h", description: "With project" });
    await submitWeek(emp.ctx, { weekStart: week() });
    await reviewTimesheet(pm.ctx, ts.id, { decision: "approve" });
    await expect(withdrawWeek(emp.ctx, { weekStart: week() })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(deleteEntry(emp.ctx, e.id)).rejects.toMatchObject({ code: "CONFLICT" });
    // A manager can't approve their own week; the owner can approve theirs.
    await createEntry(pm.ctx, { workDate: today(), duration: "1h" });
    await submitWeek(pm.ctx, { weekStart: week() });
    const own = (await listTimesheets(pm.ctx, { status: "submitted" })).find((t) => t.member.id === pm.member.id)!;
    expect(own.canReview).toBe(false);
    await expect(reviewTimesheet(pm.ctx, own.id, { decision: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await createEntry(owner, { workDate: today(), duration: "1h" });
    await submitWeek(owner, { weekStart: week() });
    const ownerTs = (await listTimesheets(owner, { status: "submitted" })).find((t) => t.member.id === owner.memberId)!;
    await reviewTimesheet(owner, ownerTs.id, { decision: "approve" });
  });

  it("bills a project's billable hours to a draft invoice once", async () => {
    const { org, ctx: owner } = await createOrgWithOwner("time-bill");
    const emp = await addMember(org.id, "employee");
    const company = await createCompany(owner, { name: "Hunza Travels" });
    const p = await createProject(owner, { name: "Booking site", companyId: company.id, memberIds: [emp.member.id] });
    await createEntry(emp.ctx, { workDate: today(), duration: "2:30", projectId: p.id, billable: true });
    await createEntry(owner, { workDate: today(), duration: "1h", projectId: p.id, billable: true });
    await createEntry(owner, { workDate: today(), duration: "3h", projectId: p.id, billable: false });
    const rep = await getTimeReport(owner, { from: today(), to: today() });
    expect(rep.projects[0]).toMatchObject({ name: "Booking site", company: "Hunza Travels", minutes: 390, billable: 210, unbilled: 210 });
    const inv = await billProjectHours(owner, { projectId: p.id, rate: "40" });
    expect(inv).toMatchObject({ number: "INV-0001", hours: 3.5 });
    const doc = await getDocument(owner, inv.id);
    expect(doc).toMatchObject({ billToName: "Hunza Travels", company: { id: company.id }, project: { id: p.id }, total: 140 });
    expect(doc.lines.map((l) => l.quantity).sort()).toEqual([1, 2.5]);
    await expect(billProjectHours(owner, { projectId: p.id, rate: 40 })).rejects.toMatchObject({ code: "CONFLICT" });
    // Billed hours are locked for their owner…
    const [billed] = (await listEntries(emp.ctx, { from: today(), to: today() }));
    expect(billed.invoice).toEqual({ id: inv.id, number: "INV-0001" });
    await expect(deleteEntry(emp.ctx, billed.id)).rejects.toMatchObject({ code: "CONFLICT" });
    // …until the draft invoice is deleted.
    await deleteDocument(owner, inv.id);
    expect((await getTimeReport(owner, { from: today(), to: today() })).projects[0].unbilled).toBe(210);
    // Only people who see all time and create invoices can bill.
    await expect(billProjectHours(emp.ctx, { projectId: p.id, rate: 40 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never shows or bills another organization's time", async () => {
    const a = await createOrgWithOwner("time-victim");
    const b = await createOrgWithOwner("time-attacker");
    const p = await createProject(a.ctx, { name: "Victim project" });
    const e = await createEntry(a.ctx, { workDate: today(), duration: "2h", projectId: p.id, billable: true });
    await createEntry(a.ctx, { workDate: addDays(week(), 0) <= today() ? week() : today(), duration: "1h" });
    await submitWeek(a.ctx, { weekStart: week() });
    const [ts] = await listTimesheets(a.ctx);
    const x = b.ctx;
    expect((await getTimeReport(x, { from: week(), to: today() })).total).toBe(0);
    expect(await listTimesheets(x)).toEqual([]);
    await expect(getWeek(x, { weekStart: week(), memberId: a.ctx.memberId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listEntries(x, { memberId: a.ctx.memberId, from: week(), to: today() })).toEqual([]);
    for (const run of [
      () => updateEntry(x, e.id, { workDate: today(), duration: "1h" }), () => deleteEntry(x, e.id),
      () => reviewTimesheet(x, ts.id, { decision: "approve" }), () => billProjectHours(x, { projectId: p.id, rate: 10 }),
    ]) await expect(run()).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createEntry(x, { workDate: today(), duration: "1h", projectId: p.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    // The database refuses a cross-organization link as well.
    await expect(db()`insert into time_entry (organization_id, member_id, project_id, work_date, minutes)
      values (${b.org.id}, ${b.ctx.memberId}, ${p.id}, now(), 10)`).rejects.toMatchObject({ code: "23503" });
    expect((await listTimesheets(a.ctx))[0].status).toBe("submitted");
  });
});
