import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { todayIn } from "@/server/time/entries";
import { getWeek } from "@/server/time/timesheets";
import { NotFoundError } from "@/lib/errors";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { weekStartOf } from "@/lib/validation/time";
import { STATUS_LABEL, STATUS_TONE, WeekBody, WeekNav } from "../../_components/week";

export const metadata: Metadata = { title: "Timesheet" };

async function PersonWeek({ params, searchParams }: PageProps<"/[organizationSlug]/time/people/[memberId]">) {
  const [{ organizationSlug, memberId }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "time.entry.read_all") && !can(ctx, "time.timesheet.approve")) return <PermissionDenied what="other people's time" />;
  const today = todayIn(ctx.organization.timezone);
  const thisWeek = weekStartOf(today);
  const weekStart = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? weekStartOf(sp.week) : thisWeek;
  const week = await getWeek(ctx, { weekStart, memberId }).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const base = `/${ctx.organization.slug}/time`;
  return (
    <>
      <Link href={can(ctx, "time.timesheet.approve") ? `${base}/approvals` : `${base}/reports`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">{week.member.name}</h1><p className="text-sm text-muted-foreground">Timesheet, read-only.</p></div>
        <Badge tone={STATUS_TONE[week.status]}>{STATUS_LABEL[week.status]}</Badge>
      </div>
      <WeekNav href={(w) => `${base}/people/${memberId}?week=${w}`} weekStart={weekStart} thisWeek={thisWeek} />
      <WeekBody week={week} today={today} slug={ctx.organization.slug} work={[]} editable={false} />
    </>
  );
}

export default function PersonWeekPage(props: PageProps<"/[organizationSlug]/time/people/[memberId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-48" /></div>}><PersonWeek {...props} /></Suspense>;
}
