import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import type { WeekView } from "@/server/time/timesheets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteEntryButton, EntryDialog, type Work } from "@/modules/time/time-ui";
import { addDays, formatMinutes } from "@/lib/validation/time";
import { cn } from "@/lib/utils";

export const STATUS_LABEL = { open: "Not submitted", submitted: "Waiting for approval", approved: "Approved", rejected: "Sent back" } as const;
export const STATUS_TONE = { open: "neutral", submitted: "warning", approved: "success", rejected: "danger" } as const;

const dayName = (d: string, style: "short" | "long" = "short") => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });
const dayNum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function WeekNav({ href, weekStart, thisWeek }: { href: (week: string) => string; weekStart: string; thisWeek: string }) {
  const end = addDays(weekStart, 6);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="secondary" size="icon" aria-label="Previous week"><Link href={href(addDays(weekStart, -7))}><ChevronLeft /></Link></Button>
      <p className="min-w-44 text-center text-sm font-semibold">{dayNum(weekStart)} – {dayNum(end)}</p>
      <Button asChild variant="secondary" size="icon" aria-label="Next week" className={cn(weekStart >= thisWeek && "pointer-events-none opacity-40")}><Link href={href(addDays(weekStart, 7))} aria-disabled={weekStart >= thisWeek}><ChevronRight /></Link></Button>
      {weekStart !== thisWeek && <Link href={href(thisWeek)} className="text-sm text-muted-foreground hover:text-foreground hover:underline">This week</Link>}
    </div>
  );
}

/** The 7-day strip plus every entry grouped by day. Editable only for your own open week. */
export function WeekBody({ week, today, slug, work, editable }: { week: WeekView; today: string; slug: string; work: Work; editable: boolean }) {
  const max = Math.max(480, ...week.days.map((d) => d.minutes));
  const byDay = week.days.map((d) => ({ ...d, entries: week.entries.filter((e) => e.workDate === d.date) })).filter((d) => d.entries.length > 0).reverse();
  return (
    <>
      <Card className="motion-safe:animate-rise p-5 [animation-delay:60ms] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">This week</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMinutes(week.total)}<span className="ml-1 text-base font-normal text-muted-foreground">h</span></p>
          </div>
          <p className="text-sm text-muted-foreground">{formatMinutes(week.billable)} h billable{week.total ? ` · ${Math.round((week.billable / week.total) * 100)}%` : ""}</p>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-2 sm:gap-3">
          {week.days.map((d, i) => (
            <div key={d.date} className={cn("grid gap-1.5 text-center", d.date > today && "opacity-40")}>
              <div className="relative mx-auto flex h-24 w-full max-w-12 items-end overflow-hidden rounded-lg bg-surface-muted">
                {d.minutes > 0 && <div className="w-full origin-bottom rounded-lg bg-primary motion-safe:animate-grow-y" style={{ height: `${Math.max(6, (d.minutes / max) * 100)}%`, animationDelay: `${120 + i * 50}ms` }} />}
              </div>
              <p className={cn("text-xs font-medium", d.date === today && "text-foreground underline underline-offset-4")}>{dayName(d.date)}</p>
              <p className="text-xs tabular-nums text-muted-foreground">{d.minutes ? formatMinutes(d.minutes) : "–"}</p>
            </div>
          ))}
        </div>
      </Card>

      {byDay.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No time this week yet.{editable ? " Start the timer or add time you already worked." : ""}</Card>
      ) : byDay.map((d, gi) => (
        <section key={d.date} className="motion-safe:animate-rise grid gap-2" style={{ animationDelay: `${120 + gi * 50}ms` }}>
          <h2 className="flex items-baseline justify-between text-sm font-semibold"><span>{dayName(d.date, "long")}, {dayNum(d.date)}</span><span className="tabular-nums text-muted-foreground">{formatMinutes(d.minutes)}</span></h2>
          <Card className="divide-y divide-border overflow-hidden">
            {d.entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.description || (e.task?.title ?? "Work")}</p>
                  <p className="truncate text-xs text-muted-foreground">{[e.project?.name, e.task && e.description ? e.task.title : null].filter(Boolean).join(" · ") || "No project"}</p>
                </div>
                {e.billable && <Badge tone="primary">Billable</Badge>}
                {e.invoice && <Badge tone="success">On {e.invoice.number}</Badge>}
                {e.running ? <Badge tone="danger">Running</Badge> : <span className="w-14 text-right font-mono text-sm font-semibold tabular-nums">{formatMinutes(e.minutes)}</span>}
                {editable && !e.running && !e.invoice && (
                  <div className="flex gap-0.5">
                    <EntryDialog slug={slug} work={work} today={today} defaultDate={e.workDate}
                      entry={{ id: e.id, workDate: e.workDate, minutes: e.minutes, projectId: e.project?.id ?? null, taskId: e.task?.id ?? null, description: e.description, billable: e.billable }}
                      trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.description ?? "time"}`}><Pencil /></Button>} />
                    <DeleteEntryButton slug={slug} id={e.id} label={`${formatMinutes(e.minutes)} on ${dayName(e.workDate, "long")}`} />
                  </div>
                )}
              </div>
            ))}
          </Card>
        </section>
      ))}
    </>
  );
}

export function AddTimeButton({ slug, work, today, defaultDate }: { slug: string; work: Work; today: string; defaultDate: string }) {
  return <EntryDialog slug={slug} work={work} today={today} defaultDate={defaultDate} trigger={<Button variant="secondary"><Plus />Add time</Button>} />;
}
