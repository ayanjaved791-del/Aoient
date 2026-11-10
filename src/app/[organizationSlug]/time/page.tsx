import type { Metadata } from "next";
import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getRunningTimer, listTrackableWork, todayIn } from "@/server/time/entries";
import { getWeek } from "@/server/time/timesheets";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TimerCard, WeekSubmit } from "@/modules/time/time-ui";
import { weekStartOf } from "@/lib/validation/time";
import { AddTimeButton, STATUS_LABEL, STATUS_TONE, WeekBody, WeekNav } from "./_components/week";

export const metadata: Metadata = { title: "My time" };

async function MyTime({ params, searchParams }: PageProps<"/[organizationSlug]/time">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "time.entry.own")) return <PermissionDenied what="time tracking" />;
  const today = todayIn(ctx.organization.timezone);
  const thisWeek = weekStartOf(today);
  const asked = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? weekStartOf(sp.week) : thisWeek;
  const weekStart = asked > thisWeek ? thisWeek : asked;
  const [week, running, work, current] = await Promise.all([
    getWeek(ctx, { weekStart }), getRunningTimer(ctx), listTrackableWork(ctx),
    weekStart === thisWeek ? null : getWeek(ctx, { weekStart: thisWeek }),
  ]);
  const base = `/${ctx.organization.slug}/time`;
  const editable = week.status === "open" || week.status === "rejected";
  const thisWeekLocked = (current ?? week).status === "submitted" || (current ?? week).status === "approved";
  return (
    <>
      <PageHeader title="My time" description="Run a timer while you work, or add time afterwards. Submit each week for approval."
        actions={editable ? <AddTimeButton slug={ctx.organization.slug} work={work} today={today} defaultDate={weekStart === thisWeek ? today : weekStart} /> : undefined} />
      <TimerCard slug={ctx.organization.slug} work={work} locked={!running && thisWeekLocked}
        running={running ? { id: running.id, startedAt: running.startedAt!.toISOString(), description: running.description, project: running.project?.name ?? null, task: running.task?.title ?? null, billable: running.billable } : null} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekNav href={(w) => `${base}?week=${w}`} weekStart={weekStart} thisWeek={thisWeek} />
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[week.status]}>{STATUS_LABEL[week.status]}</Badge>
          <WeekSubmit slug={ctx.organization.slug} weekStart={weekStart} status={week.status} total={week.total} running={week.entries.some((e) => e.running)} />
        </div>
      </div>
      {week.status === "rejected" && week.timesheet && (
        <Alert tone="danger" title={`${week.timesheet.reviewedBy ?? "Your manager"} sent this week back`}>{week.timesheet.note ?? "Check your time and submit it again."}</Alert>
      )}
      {week.status === "approved" && week.timesheet && <p className="text-sm text-muted-foreground">Approved by {week.timesheet.reviewedBy ?? "a manager"}. This week is locked.</p>}
      <WeekBody week={week} today={today} slug={ctx.organization.slug} work={work} editable={editable} />
    </>
  );
}

export default function MyTimePage(props: PageProps<"/[organizationSlug]/time">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-36" /><Skeleton className="h-48" /></div>}><MyTime {...props} /></Suspense>;
}
