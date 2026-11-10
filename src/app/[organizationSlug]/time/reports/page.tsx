import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { todayIn } from "@/server/time/entries";
import { getTimeReport } from "@/server/time/reports";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BillHoursDialog } from "@/modules/time/time-ui";
import { addDays, formatMinutes, weekStartOf } from "@/lib/validation/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Time reports" };

function ranges(today: string) {
  const w = weekStartOf(today);
  const m = `${today.slice(0, 7)}-01`;
  const prevM = new Date(`${m}T12:00:00Z`); prevM.setUTCMonth(prevM.getUTCMonth() - 1);
  const pm = prevM.toISOString().slice(0, 10);
  return [
    { k: "week", l: "This week", from: w, to: addDays(w, 6) },
    { k: "lastweek", l: "Last week", from: addDays(w, -7), to: addDays(w, -1) },
    { k: "month", l: "This month", from: m, to: today },
    { k: "lastmonth", l: "Last month", from: pm, to: addDays(m, -1) },
  ];
}

async function Reports({ params, searchParams }: PageProps<"/[organizationSlug]/time/reports">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "time.entry.read_all")) return <PermissionDenied what="the team's time" />;
  const today = todayIn(ctx.organization.timezone);
  const opts = ranges(today);
  const r = opts.find((o) => o.k === sp.range) ?? opts[0];
  const rep = await getTimeReport(ctx, { from: r.from, to: r.to });
  const base = `/${ctx.organization.slug}`;
  const canBill = can(ctx, "finance.invoice.create");
  const maxDay = Math.max(60, ...rep.days.map((d) => d.minutes));
  const maxPerson = Math.max(1, ...rep.people.map((p) => p.minutes));
  const unbilledTotal = rep.projects.reduce((s, p) => s + p.unbilled, 0);
  const kpis = [
    { l: "Hours logged", v: formatMinutes(rep.total) },
    { l: "Billable", v: rep.total ? `${Math.round((rep.billable / rep.total) * 100)}%` : "—", s: `${formatMinutes(rep.billable)} h` },
    { l: "Not invoiced yet", v: formatMinutes(unbilledTotal), s: "billable hours" },
    { l: "Waiting for approval", v: String(rep.pendingTimesheets), s: "timesheets", href: can(ctx, "time.timesheet.approve") ? `${base}/time/approvals` : undefined },
  ];
  return (
    <>
      <PageHeader title="Time reports" description="Where the team's hours went, from recorded time. Running timers count once they're stopped." />
      <div role="group" aria-label="Period" className="inline-flex w-fit flex-wrap rounded-lg border border-border bg-surface p-0.5">
        {opts.map((o) => (
          <Link key={o.k} href={`${base}/time/reports?range=${o.k}`} aria-current={o.k === r.k ? "true" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", o.k === r.k ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-surface-muted")}>{o.l}</Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => {
          const body = <Card className={cn("motion-safe:animate-rise h-full p-4", k.href && "hover:border-primary/40")} style={{ animationDelay: `${i * 50}ms` }}><p className="text-xs text-muted-foreground">{k.l}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{k.v}</p>{k.s && <p className="text-xs text-muted-foreground">{k.s}</p>}</Card>;
          return k.href ? <Link key={k.l} href={k.href} className="block rounded-xl">{body}</Link> : <div key={k.l}>{body}</div>;
        })}
      </div>
      <Card className="motion-safe:animate-rise min-w-0 p-5 [animation-delay:120ms] sm:p-6">
        <h2 className="text-base font-semibold">Hours per day</h2>
        <div className="mt-5 flex h-40 items-end gap-1 sm:gap-2" role="list" aria-label="Hours per day">
          {rep.days.map((d, i) => (
            <div key={d.date} role="listitem" aria-label={`${d.date}: ${formatMinutes(d.minutes)} hours`} title={`${d.date}: ${formatMinutes(d.minutes)} h`} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
              <div className={cn("mx-auto w-full max-w-12 origin-bottom rounded-t-md bg-primary motion-safe:animate-grow-y", d.date > today && "opacity-30")} style={{ height: `${d.minutes ? Math.max(3, (d.minutes / maxDay) * 100) : 0}%`, animationDelay: `${150 + i * 25}ms` }} />
              {rep.days.length <= 7 && <span className="text-center text-[11px] text-muted-foreground">{new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>}
            </div>
          ))}
        </div>
      </Card>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="motion-safe:animate-rise p-5 [animation-delay:160ms]">
          <h2 className="text-sm font-semibold">By person</h2>
          {rep.people.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No time recorded in this period.</p> : (
            <ul className="mt-4 grid gap-3">
              {rep.people.map((p, i) => (
                <li key={p.memberId}>
                  <Link href={`${base}/time/people/${p.memberId}?week=${weekStartOf(r.from)}`} className="flex items-center gap-2.5 text-sm hover:underline">
                    <Avatar name={p.name} size="sm" /><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="font-mono font-semibold tabular-nums">{formatMinutes(p.minutes)}</span>
                  </Link>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                    <div className="h-full origin-left bg-primary motion-safe:animate-grow-x" style={{ width: `${(p.billable / maxPerson) * 100}%`, animationDelay: `${200 + i * 40}ms` }} />
                    <div className="h-full origin-left bg-muted-foreground/40 motion-safe:animate-grow-x" style={{ width: `${((p.minutes - p.billable) / maxPerson) * 100}%`, animationDelay: `${200 + i * 40}ms` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {rep.people.length > 0 && <p className="mt-4 flex gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />Billable</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted-foreground/40" />Other</span></p>}
        </Card>
        <Card className="motion-safe:animate-rise min-w-0 overflow-hidden [animation-delay:200ms]">
          <h2 className="px-5 pt-5 text-sm font-semibold">By project</h2>
          {rep.projects.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No time recorded in this period.</p> : (
            <div className="scroll-thin mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-surface-muted text-left text-xs text-muted-foreground">
                  <tr><th scope="col" className="px-5 py-2.5 font-medium">Project</th><th scope="col" className="px-4 py-2.5 text-right font-medium">Hours</th><th scope="col" className="px-4 py-2.5 text-right font-medium">Billable</th><th scope="col" className="px-4 py-2.5 text-right font-medium">Not invoiced</th><th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rep.projects.map((p) => (
                    <tr key={p.projectId ?? "none"}>
                      <td className="max-w-56 px-5 py-3"><p className="truncate font-medium">{p.projectId ? <Link href={`${base}/projects/${p.projectId}`} className="hover:underline">{p.name}</Link> : <span className="text-muted-foreground">{p.name}</span>}</p>{p.company && <p className="truncate text-xs text-muted-foreground">{p.company}</p>}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{formatMinutes(p.minutes)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">{formatMinutes(p.billable)}</td>
                      <td className={cn("px-4 py-3 text-right font-mono tabular-nums", p.unbilled > 0 && "font-semibold")}>{p.unbilled ? formatMinutes(p.unbilled) : "—"}</td>
                      <td className="px-5 py-2.5 text-right">{canBill && p.projectId && p.unbilled > 0 && (
                        <BillHoursDialog slug={ctx.organization.slug} projectId={p.projectId} projectName={p.name} unbilled={p.unbilled} currency={ctx.organization.currency} from={r.from} to={r.to} invoicesBase={`${base}/finance/invoices`} />
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

export default function TimeReportsPage(props: PageProps<"/[organizationSlug]/time/reports">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-24" /><Skeleton className="h-60" /></div>}><Reports {...props} /></Suspense>;
}
