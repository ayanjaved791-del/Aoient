import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarOff, Inbox } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getMyEmployeeId } from "@/server/people/employees";
import { listLeave, type LeaveRow } from "@/server/people/leave";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CancelLeaveButton, DecideLeaveButtons, LeaveStatusBadge, RequestLeaveDialog } from "@/modules/people/leave-ui";
import { LEAVE_LABELS } from "@/modules/people/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leave" };

type Props = PageProps<"/[organizationSlug]/people/leave">;
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function LeaveList({ rows, slug, base, mode }: { rows: LeaveRow[]; slug: string; base: string; mode: "mine" | "team" }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ul className="divide-y divide-border">
      {rows.map((l) => (
        <li key={l.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4">
          {mode === "team" && <Avatar name={l.employee.name} />}
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="text-sm font-medium">
              {mode === "team" && <><Link href={`${base}/${l.employee.id}`} className="hover:underline">{l.employee.name}</Link><span className="text-muted-foreground"> · </span></>}
              {LEAVE_LABELS[l.type]} · {l.days} {l.days === 1 ? "day" : "days"}
            </p>
            <p className="text-xs text-muted-foreground">{fmt(l.startDate)}{l.endDate !== l.startDate ? ` – ${fmt(l.endDate)}` : ""}{l.decidedBy ? ` · ${l.status === "approved" ? "approved" : "decided"} by ${l.decidedBy}` : ""}</p>
            {l.reason && <p className="mt-1 text-sm text-secondary-foreground [overflow-wrap:anywhere]">“{l.reason}”</p>}
            {l.decisionNote && <p className="mt-1 text-xs text-muted-foreground">Note: {l.decisionNote}</p>}
          </div>
          <div className="flex items-center gap-2">
            <LeaveStatusBadge status={l.status} />
            {mode === "team" && l.status === "pending" && !l.isMine && <DecideLeaveButtons slug={slug} id={l.id} name={l.employee.name} />}
            {mode === "mine" && (l.status === "pending" || (l.status === "approved" && l.startDate > today)) && <CancelLeaveButton slug={slug} id={l.id} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

async function Leave({ params, searchParams }: Props) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  const canRequest = can(ctx, "people.leave.request");
  const approver = can(ctx, "people.leave.approve");
  if (!canRequest && !approver) return <PermissionDenied what="leave" />;
  const slug = ctx.organization.slug;
  const base = `/${slug}/people`;
  const tab = approver && (sp.tab === "team" || !canRequest) ? "team" : "mine";
  const filter = sp.status === "all" ? "all" : "pending";
  const [myId, rows] = await Promise.all([
    getMyEmployeeId(ctx),
    tab === "team" ? listLeave(ctx, { scope: "team", status: filter }) : listLeave(ctx, { scope: "mine" }),
  ]);
  const tabLink = (t: string, label: string) => (
    <Link href={`${base}/leave?tab=${t}`} aria-current={tab === t ? "page" : undefined}
      className={cn("rounded-md px-3 py-1.5 text-sm font-medium", tab === t ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-surface-muted")}>{label}</Link>
  );

  return (
    <div className="grid gap-6">
      <PageHeader title="Leave" description="Request time off and track approvals. Weekends aren't counted as leave days."
        actions={canRequest && myId ? <RequestLeaveDialog slug={slug} /> : undefined} />
      {approver && canRequest && <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-surface p-0.5">{tabLink("mine", "My leave")}{tabLink("team", "Team requests")}</div>}

      {tab === "mine" && canRequest && !myId && (
        <Card className="p-5 text-sm">Your account isn&apos;t linked to an employee record yet, so you can&apos;t request leave. Ask HR or an admin to link it from your People profile.</Card>
      )}

      {tab === "team" && (
        <div className="flex gap-2 text-sm">
          <Link href={`${base}/leave?tab=team`} className={cn("rounded-full border px-3 py-1", filter === "pending" ? "border-primary bg-primary-subtle text-primary" : "border-border")}>Waiting for review</Link>
          <Link href={`${base}/leave?tab=team&status=all`} className={cn("rounded-full border px-3 py-1", filter === "all" ? "border-primary bg-primary-subtle text-primary" : "border-border")}>All requests</Link>
        </div>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={tab === "team" ? Inbox : CalendarOff}
            title={tab === "team" ? (filter === "pending" ? "Nothing to review" : "No leave requests yet") : "No leave requested yet"}
            description={tab === "team" ? "New requests from your team appear here." : myId ? "Use “Request leave” to ask for time off." : undefined} />
        ) : <LeaveList rows={rows} slug={slug} base={base} mode={tab} />}
      </Card>
    </div>
  );
}

export default function LeavePage(props: Props) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-72" /></div>}><Leave {...props} /></Suspense>;
}
