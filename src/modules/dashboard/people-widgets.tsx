import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Cake, CalendarClock, CalendarRange, MapPin, Network, PartyPopper, Plane, Sprout } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EMPLOYMENT_LABELS, LEAVE_LABELS } from "@/modules/people/labels";
import type { PeopleInsights } from "@/server/dashboard/people-insights";
import { cn } from "@/lib/utils";

/**
 * A whole number that counts up from zero when the page opens (CSS only, so it
 * renders on the server and needs no JavaScript). Screen readers get the
 * plain number; people who ask for less motion see it straight away.
 */
export function CountUp({ value, delay = 0, className }: { value: number; delay?: number; className?: string }) {
  if (!Number.isInteger(value) || value < 0) return <span className={className}>{value}</span>;
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="sr-only">{value}</span>
      <span aria-hidden className="count-up" style={{ "--count-to": value, "--count-delay": `${delay}ms` } as CSSProperties} />
    </span>
  );
}

function Panel({ title, subtitle, icon: Icon, action, delay, className, children }: {
  title: string; subtitle?: string; icon: typeof Plane; action?: { href: string; label: string }; delay: number; className?: string; children: ReactNode;
}) {
  return (
    <Card className={cn("motion-safe:animate-rise group/panel flex h-full min-w-0 flex-col p-5 transition-shadow hover:shadow-sm sm:p-6", className)} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform duration-300 group-hover/panel:-rotate-6 group-hover/panel:scale-105">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <Link href={action.href} className="shrink-0 text-sm font-medium text-primary hover:underline">{action.label}</Link>}
      </div>
      <div className="mt-5 flex-1">{children}</div>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="flex h-full min-h-24 items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

const day = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
const span = (a: string, b: string) => (a === b ? day(a, { month: "short", day: "numeric" }) : `${day(a, { month: "short", day: "numeric" })} – ${day(b, { month: "short", day: "numeric" })}`);
const inDaysText = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 ? `in ${n} days` : n === -1 ? "yesterday" : `${-n} days ago`);

/** Seven columns, one per day from today: how many people are away, and who's away soon. */
export function OutThisWeek({ insights, base, delay }: { insights: PeopleInsights; base: string; delay: number }) {
  const max = Math.max(1, ...insights.week.map((d) => d.out));
  const total = insights.week.reduce((a, d) => a + d.out, 0);
  return (
    <Panel title="Out this week" subtitle={total === 0 ? "Everyone's in for the next 7 days" : "Approved leave, today and the next 6 days"} icon={Plane}
      action={{ href: `${base}/people/leave`, label: "Leave" }} delay={delay}>
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="People on leave each day">
        {insights.week.map((d, i) => (
          <li key={d.day} className={cn("flex flex-col items-center rounded-xl border px-1 pb-2 pt-2.5 text-center", i === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
            <span className={cn("text-[11px] font-medium uppercase tracking-wide", i === 0 ? "opacity-70" : "text-muted-foreground")}>{i === 0 ? "Today" : day(d.day, { weekday: "short" })}</span>
            <span className="text-lg font-semibold tabular-nums">{day(d.day, { day: "numeric" })}</span>
            <span className="mt-2 flex h-14 w-full items-end justify-center" aria-hidden>
              <span className={cn("w-3 rounded-full motion-safe:animate-grow-y origin-bottom", d.out ? (i === 0 ? "bg-primary-foreground" : "bg-primary") : (i === 0 ? "bg-primary-foreground/25" : "bg-surface-muted"))}
                style={{ height: `${d.out ? Math.max(18, (d.out / max) * 100) : 10}%`, animationDelay: `${delay + 200 + i * 60}ms` }} />
            </span>
            <span className={cn("mt-1.5 text-xs font-medium tabular-nums", i === 0 ? "" : "text-secondary-foreground")}>{d.out} out</span>
          </li>
        ))}
      </ol>
      {insights.upcomingLeave.length > 0 && (
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {insights.upcomingLeave.map((l, i) => (
            <li key={l.id} className="motion-safe:animate-rise flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-muted/70" style={{ animationDelay: `${delay + 300 + i * 50}ms` }}>
              <Avatar name={l.name} size="sm" />
              <Link href={`${base}/people/${l.employeeId}`} className="grid min-w-0 flex-1 hover:underline">
                <span className="truncate text-sm font-medium">{l.name}</span>
                <span className="truncate text-xs text-muted-foreground">{LEAVE_LABELS[l.type]} · {span(l.start, l.end)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Employment types as a ring that draws itself, in shades of ink. */
export function EmploymentMix({ byType, headcount, delay }: { byType: { type: string; count: number }[]; headcount: number; delay: number }) {
  const shades = ["var(--foreground)", "color-mix(in oklab, var(--foreground) 62%, var(--surface))", "color-mix(in oklab, var(--foreground) 36%, var(--surface))", "color-mix(in oklab, var(--foreground) 18%, var(--surface))"];
  const r = 42, c = 2 * Math.PI * r;
  const segments = byType.map((t, i) => {
    const before = byType.slice(0, i).reduce((a, x) => a + x.count, 0);
    return { ...t, len: headcount ? (t.count / headcount) * c : 0, offset: headcount ? (before / headcount) * c : 0, shade: shades[i % shades.length] };
  });
  return (
    <Panel title="Employment mix" subtitle={`${headcount} active ${headcount === 1 ? "person" : "people"}`} icon={Sprout} delay={delay}>
      {headcount === 0 ? <Empty>No active people yet.</Empty> : (
        <div className="flex items-center gap-5">
          <div className="relative size-32 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={segments.map((s) => `${EMPLOYMENT_LABELS[s.type] ?? s.type}: ${s.count}`).join(", ")}>
              <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-muted)" strokeWidth="12" />
              {segments.map((s, i) => (
                <circle key={s.type} cx="50" cy="50" r={r} fill="none" stroke={s.shade} strokeWidth="12"
                  strokeDasharray={`${Math.max(0, s.len - (segments.length > 1 ? 1.5 : 0))} ${c}`} strokeDashoffset={-s.offset}
                  className="motion-safe:animate-draw" style={{ animationDelay: `${delay + 150 + i * 120}ms` }} />
              ))}
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div><CountUp value={headcount} delay={delay + 100} className="block text-2xl font-semibold" /><span className="text-[11px] text-muted-foreground">people</span></div>
            </div>
          </div>
          <ul className="grid min-w-0 flex-1 gap-2.5">
            {segments.map((s) => (
              <li key={s.type} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full ring-1 ring-border" style={{ background: s.shade }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{EMPLOYMENT_LABELS[s.type] ?? s.type}</span>
                <span className="font-medium tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** Horizontal bars that grow in one after another. */
export function GrowBars({ rows, delay, total }: { rows: { label: string; value: number; href?: string }[]; delay: number; total?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-3.5">
      {rows.map((r, i) => (
        <li key={r.label} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            {r.href ? <Link href={r.href} className="truncate hover:underline">{r.label}</Link> : <span className="truncate">{r.label}</span>}
            <span className="font-medium tabular-nums">{r.value}{total ? <span className="ml-1 text-xs font-normal text-muted-foreground">{Math.round((r.value / total) * 100)}%</span> : null}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
            {r.value > 0 && <div className="h-full origin-left rounded-full bg-primary motion-safe:animate-grow-x" style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, animationDelay: `${delay + 120 + i * 70}ms` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Departments({ insights, base, headcount, delay }: { insights: PeopleInsights; base: string; headcount: number; delay: number }) {
  return (
    <Panel title="Headcount by department" subtitle={`${insights.departments.filter((d) => d.id).length} departments`} icon={Network} action={{ href: `${base}/people/departments`, label: "Manage" }} delay={delay}>
      {insights.departments.length === 0 ? <Empty>No departments yet.</Empty> : (
        <GrowBars delay={delay} total={headcount} rows={insights.departments.slice(0, 6).map((d) => ({ label: d.name, value: d.count, href: d.id ? `${base}/people?dept=${d.id}` : undefined }))} />
      )}
    </Panel>
  );
}

/** How long people have been here (a stacked bar) and where they work. */
export function TeamSnapshot({ insights, delay }: { insights: PeopleInsights; delay: number }) {
  const known = insights.tenure.reduce((a, t) => a + t.count, 0);
  const shades = ["bg-primary/25", "bg-primary/50", "bg-primary/75", "bg-primary"];
  return (
    <Panel title="Team snapshot" subtitle="How long people have been here, and where they work" icon={CalendarClock} delay={delay}>
      {known === 0 ? <p className="text-sm text-muted-foreground">Add start dates to people to see how long they&apos;ve been here.</p> : (
        <>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={insights.tenure.map((t) => `${t.label}: ${t.count}`).join(", ")}>
            {insights.tenure.map((t, i) => t.count > 0 && (
              <span key={t.label} className={cn("h-full origin-left motion-safe:animate-grow-x", shades[i])} style={{ width: `${(t.count / known) * 100}%`, animationDelay: `${delay + 150 + i * 90}ms` }} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {insights.tenure.map((t, i) => (
              <li key={t.label} className="flex items-center gap-2 text-xs">
                <span className={cn("size-2 shrink-0 rounded-full", shades[i])} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{t.label}</span>
                <span className="font-medium tabular-nums">{t.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {insights.locations.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Locations</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {insights.locations.map((l, i) => (
              <li key={l.name} className="motion-safe:animate-rise inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs" style={{ animationDelay: `${delay + 200 + i * 50}ms` }}>
                <MapPin className="size-3 text-muted-foreground" aria-hidden />{l.name}<span className="font-semibold tabular-nums">{l.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** Work anniversaries and new starters, from start dates. */
export function Milestones({ insights, base, delay }: { insights: PeopleInsights; base: string; delay: number }) {
  const items = [
    ...insights.anniversaries.map((a) => ({ key: `a-${a.id}`, id: a.id, name: a.name, icon: Cake, title: `${a.years} ${a.years === 1 ? "year" : "years"} at work`, when: a.inDays, sort: a.inDays })),
    ...insights.newStarters.map((n) => ({ key: `n-${n.id}`, id: n.id, name: n.name, icon: PartyPopper, title: n.inDays > 0 ? `Starts${n.jobTitle ? ` as ${n.jobTitle}` : ""}` : `Joined${n.jobTitle ? ` as ${n.jobTitle}` : ""}`, when: n.inDays, sort: Math.abs(n.inDays) })),
  ].sort((a, b) => a.sort - b.sort).slice(0, 6);
  return (
    <Panel title="Milestones" subtitle="Work anniversaries and new starters, 30 days either way" icon={PartyPopper} delay={delay}>
      {items.length === 0 ? <Empty>No anniversaries or new starters around now.</Empty> : (
        <ul className="grid gap-3">
          {items.map((m, i) => (
            <li key={m.key} className="motion-safe:animate-rise flex items-center gap-3" style={{ animationDelay: `${delay + 150 + i * 60}ms` }}>
              <span className="relative">
                <Avatar name={m.name} size="sm" />
                <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-surface"><m.icon className="size-2.5" aria-hidden /></span>
              </span>
              <Link href={`${base}/people/${m.id}`} className="grid min-w-0 flex-1 hover:underline">
                <span className="truncate text-sm font-medium">{m.name}</span>
                <span className="truncate text-xs text-muted-foreground">{m.title}</span>
              </Link>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", m.when === 0 ? "bg-primary text-primary-foreground" : "bg-surface-muted text-secondary-foreground")}>{inDaysText(m.when)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function LeaveByType({ rows, delay }: { rows: { type: string; days: number }[]; delay: number }) {
  const year = new Date().getFullYear();
  const total = rows.reduce((a, r) => a + r.days, 0);
  return (
    <Panel title={`Leave taken in ${year}`} subtitle={`${Math.round(total * 10) / 10} approved days, by type`} icon={CalendarRange} delay={delay}>
      {rows.length === 0 ? <Empty>No approved leave this year yet.</Empty> : (
        <GrowBars delay={delay} rows={rows.map((r) => ({ label: LEAVE_LABELS[r.type] ?? r.type, value: Math.round(r.days * 10) / 10 }))} />
      )}
    </Panel>
  );
}
