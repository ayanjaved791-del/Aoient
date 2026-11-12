import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck, Users } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import {
  getAttendanceSetting, getAttendanceSummary, getMyToday, getRegister, listMyAttendance, todayFor, type AttendanceDay,
} from "@/server/people/attendance";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceBadge, AttendanceSettingsDialog, CheckInCard, ClearDayButton, CorrectDialog, PeriodPicker } from "@/modules/people/attendance-ui";
import { hours } from "@/modules/people/attendance-format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Attendance" };
type Props = PageProps<"/[organizationSlug]/people/attendance">;
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

async function Attendance({ params, searchParams }: Props) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  const own = can(ctx, "people.attendance.own");
  const manage = can(ctx, "people.attendance.manage");
  if (!own && !manage) return <PermissionDenied what="attendance" />;
  const slug = ctx.organization.slug;
  const base = `/${slug}/people/attendance`;
  const today = todayFor(ctx);
  const tab = manage && (sp.tab === "register" || sp.tab === "report" || !own) ? (sp.tab === "report" ? "report" : "register") : "mine";
  const setting = await getAttendanceSetting(ctx);
  const tabLink = (t: string, label: string) => (
    <Link href={`${base}?tab=${t}`} aria-current={tab === t ? "page" : undefined}
      className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium", tab === t ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-surface-muted")}>{label}</Link>
  );

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="Attendance" description={`Check in when you start and check out when you finish. The day starts at ${setting.workStarts} (${ctx.organization.timezone}).`}
        actions={manage ? <AttendanceSettingsDialog slug={slug} workStarts={setting.workStarts} graceMinutes={setting.graceMinutes} /> : undefined} />
      {manage && (
        <div className="scroll-thin inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-0.5">
          {own && tabLink("mine", "My attendance")}{tabLink("register", "Daily register")}{tabLink("report", "Monthly report")}
        </div>
      )}
      {tab === "mine" && <Mine ctxSlug={slug} month={isMonth(sp.month) ? sp.month : today.slice(0, 7)} today={today} startsAt={setting.workStarts} base={base} orgCtx={ctx} />}
      {tab === "register" && <Register slug={slug} date={isDay(sp.date) && sp.date <= today ? sp.date : today} today={today} base={base} orgCtx={ctx} />}
      {tab === "report" && <Report month={isMonth(sp.month) ? sp.month : today.slice(0, 7)} today={today} base={base} orgCtx={ctx} slug={slug} />}
    </div>
  );
}

type Ctx = Awaited<ReturnType<typeof getPageOrgContext>>["ctx"];

async function Mine({ ctxSlug, month, today, startsAt, base, orgCtx }: { ctxSlug: string; month: string; today: string; startsAt: string; base: string; orgCtx: Ctx }) {
  const [me, days] = await Promise.all([getMyToday(orgCtx), listMyAttendance(orgCtx, month)]);
  if (!me) return <Card className="p-5 text-sm">Your account isn&apos;t linked to an employee record yet, so you can&apos;t check in. Ask HR or an admin to link it from your People profile.</Card>;
  const worked = days.reduce((s, d) => s + (d.minutes ?? 0), 0);
  const present = days.filter((d) => d.status === "present" || d.status === "half_day").length;
  const late = days.filter((d) => d.late).length;
  return (
    <>
      <Card className="motion-safe:animate-rise p-5 sm:p-6"><CheckInCard slug={ctxSlug} checkIn={me.checkIn} checkOut={me.checkOut} minutes={me.minutes} startsAt={startsAt} date={today} /></Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span><span className="font-semibold tabular-nums">{present}</span> <span className="text-muted-foreground">days present</span></span>
          <span><span className="font-semibold tabular-nums">{late}</span> <span className="text-muted-foreground">late</span></span>
          <span><span className="font-semibold tabular-nums">{hours(worked)}</span> <span className="text-muted-foreground">worked</span></span>
        </div>
        <PeriodPicker type="month" value={month} max={today.slice(0, 7)} param="month" base={`${base}?tab=mine`} />
      </div>
      <DayTable days={days} mode="mine" />
    </>
  );
}

function DayTable({ days, mode, slug, date }: { days: AttendanceDay[]; mode: "mine" | "register"; slug?: string; date?: string }) {
  if (days.length === 0) return <Card><EmptyState icon={CalendarCheck} title="Nothing to show" description={mode === "register" ? "Add active employees in People to build the register." : "No days in this month yet."} /></Card>;
  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{mode === "register" ? "Person" : "Day"}</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">In</th>
              <th className="px-4 py-2.5 font-medium">Out</th>
              <th className="px-4 py-2.5 text-right font-medium">Worked</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Note</th>
              {mode === "register" && <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {days.map((d) => {
              const w = new Date(`${d.workDate}T00:00:00Z`).getUTCDay();
              const weekend = w === 0 || w === 6;
              return (
                <tr key={`${d.employee.id}-${d.workDate}`} className={cn(weekend && d.status === "none" && "text-muted-foreground")}>
                  <td className="px-4 py-2.5">
                    {mode === "register" ? (
                      <span className="flex items-center gap-2.5"><Avatar name={d.employee.name} size="sm" /><span className="min-w-0"><span className="block truncate font-medium">{d.employee.name}</span><span className="block truncate text-xs text-muted-foreground">{d.employee.department ?? d.employee.jobTitle ?? ""}</span></span></span>
                    ) : <span className="whitespace-nowrap font-medium">{fmtDay(d.workDate)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">{weekend && d.status === "none" ? <span className="text-xs">Weekend</span> : <AttendanceBadge status={d.status} late={d.late} />}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{d.checkIn ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{d.checkOut ?? (d.checkIn ? <span className="text-xs text-muted-foreground">still in</span> : "—")}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{hours(d.minutes)}</td>
                  <td className="hidden max-w-60 truncate px-4 py-2.5 text-xs text-muted-foreground md:table-cell">{[d.note, d.corrected ? "corrected by HR" : null].filter(Boolean).join(" · ") || ""}</td>
                  {mode === "register" && slug && date && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <CorrectDialog slug={slug} employeeId={d.employee.id} name={d.employee.name} date={date} current={{ status: d.status, checkIn: d.checkIn, checkOut: d.checkOut, note: d.note }} />
                      {d.id && <ClearDayButton slug={slug} id={d.id} name={d.employee.name} />}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function Register({ slug, date, today, base, orgCtx }: { slug: string; date: string; today: string; base: string; orgCtx: Ctx }) {
  const days = await getRegister(orgCtx, date);
  const counts = [
    { label: "People", value: days.length },
    { label: "Checked in", value: days.filter((d) => d.checkIn).length },
    { label: "Late", value: days.filter((d) => d.late).length, warn: true },
    { label: "On leave", value: days.filter((d) => d.status === "leave").length },
    { label: "Absent", value: days.filter((d) => d.status === "absent").length, danger: true },
    { label: "Not recorded", value: days.filter((d) => d.status === "none").length },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{date === today ? "Today" : fmtDay(date)}: who is in, who is late, and who is away.</p>
        <PeriodPicker type="date" value={date} max={today} param="date" base={`${base}?tab=register`} />
      </div>
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {counts.map((c, i) => (
          <Card key={c.label} className="motion-safe:animate-rise p-4" style={{ animationDelay: `${i * 40}ms` }}>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", c.warn && c.value > 0 && "text-warning", c.danger && c.value > 0 && "text-danger")}>{c.value}</p>
          </Card>
        ))}
      </div>
      <DayTable days={days} mode="register" slug={slug} date={date} />
    </>
  );
}

async function Report({ month, today, base, orgCtx, slug }: { month: string; today: string; base: string; orgCtx: Ctx; slug: string }) {
  const { workingDays, rows } = await getAttendanceSummary(orgCtx, month);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{workingDays} working day{workingDays === 1 ? "" : "s"} (Mon–Fri) so far in {new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}.</p>
        <PeriodPicker type="month" value={month} max={today.slice(0, 7)} param="month" base={`${base}?tab=report`} />
      </div>
      {rows.length === 0 ? <Card><EmptyState icon={Users} title="No one to report on" description="Active employees appear here." /></Card> : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Person</th>
                  <th className="px-4 py-2.5 text-right font-medium">Present</th>
                  <th className="px-4 py-2.5 text-right font-medium">Half days</th>
                  <th className="px-4 py-2.5 text-right font-medium">Late</th>
                  <th className="px-4 py-2.5 text-right font-medium">Leave</th>
                  <th className="px-4 py-2.5 text-right font-medium">Absent</th>
                  <th className="px-4 py-2.5 text-right font-medium">Not recorded</th>
                  <th className="px-4 py-2.5 text-right font-medium">Hours</th>
                  <th className="px-4 py-2.5 font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const pct = workingDays ? Math.round(((r.present + r.halfDays * 0.5) / Math.max(1, workingDays - r.leave)) * 100) : 0;
                  return (
                    <tr key={r.employee.id}>
                      <td className="px-4 py-2.5"><Link href={`/${slug}/people/${r.employee.id}`} className="font-medium hover:underline">{r.employee.name}</Link></td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.present}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.halfDays}</td>
                      <td className={cn("px-4 py-2.5 text-right tabular-nums", r.late > 0 && "text-warning")}>{r.late}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.leave}</td>
                      <td className={cn("px-4 py-2.5 text-right tabular-nums", r.absent > 0 && "text-danger")}>{r.absent}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.unrecorded}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{hours(r.minutes)}</td>
                      <td className="min-w-32 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden><div className="h-full origin-left rounded-full bg-primary motion-safe:animate-grow-x" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                          <span className="w-9 text-right text-xs tabular-nums">{Math.min(100, pct)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

export default function AttendancePage(props: Props) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-32" /><Skeleton className="h-72" /></div>}><Attendance {...props} /></Suspense>;
}
