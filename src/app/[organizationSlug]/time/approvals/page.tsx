import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClipboardCheck } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listTimesheets } from "@/server/time/timesheets";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ReviewTimesheet } from "@/modules/time/time-ui";
import { addDays, formatMinutes } from "@/lib/validation/time";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE } from "../_components/week";

export const metadata: Metadata = { title: "Timesheet approvals" };
const TABS = [{ k: "submitted", l: "Waiting" }, { k: "approved", l: "Approved" }, { k: "rejected", l: "Sent back" }] as const;
const range = (w: string) => `${new Date(`${w}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${addDays(w, 6)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;

async function Approvals({ params, searchParams }: PageProps<"/[organizationSlug]/time/approvals">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "time.timesheet.approve")) return <PermissionDenied what="timesheet approvals" />;
  const status = TABS.find((t) => t.k === sp.status)?.k ?? "submitted";
  const rows = await listTimesheets(ctx, { status });
  const base = `/${ctx.organization.slug}/time`;
  return (
    <>
      <PageHeader title="Approvals" description="Weekly timesheets your team submitted. Approving locks the week; sending it back lets them fix it." />
      <div role="group" aria-label="Filter timesheets" className="inline-flex w-fit rounded-lg border border-border bg-surface p-0.5">
        {TABS.map((t) => (
          <Link key={t.k} href={`${base}/approvals${t.k === "submitted" ? "" : `?status=${t.k}`}`} aria-current={t.k === status ? "true" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", t.k === status ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-surface-muted")}>{t.l}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title={status === "submitted" ? "Nothing waiting" : "Nothing here yet"} description={status === "submitted" ? "Submitted timesheets show up here for you to approve." : undefined} /></Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {rows.map((r, i) => (
            <div key={r.id} className="motion-safe:animate-rise flex flex-wrap items-center gap-3 px-4 py-3.5" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <Avatar name={r.member.name} size="sm" />
              <Link href={`${base}/people/${r.member.id}?week=${r.weekStart}`} className="min-w-0 flex-1 hover:underline">
                <p className="truncate text-sm font-medium">{r.member.name}{r.member.id === ctx.memberId && <span className="font-normal text-muted-foreground"> (you)</span>}</p>
                <p className="truncate text-xs text-muted-foreground">Week of {range(r.weekStart)}{r.note ? ` · “${r.note}”` : ""}</p>
              </Link>
              <div className="text-right"><p className="font-mono text-sm font-semibold tabular-nums">{formatMinutes(r.total)} h</p><p className="text-xs text-muted-foreground">{formatMinutes(r.billable)} billable</p></div>
              {r.canReview ? <ReviewTimesheet slug={ctx.organization.slug} id={r.id} name={r.member.name} />
                : r.status === "submitted" ? <span className="text-xs text-muted-foreground">Needs another approver</span>
                : <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}{r.reviewedBy ? ` by ${r.reviewedBy}` : ""}</Badge>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

export default function ApprovalsPage(props: PageProps<"/[organizationSlug]/time/approvals">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-72" /></div>}><Approvals {...props} /></Suspense>;
}
