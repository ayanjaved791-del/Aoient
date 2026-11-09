import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgePercent, CalendarClock, CircleDollarSign, Gauge, Info, Trophy } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getCrmReport } from "@/server/crm/reports";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp, GrowBars } from "@/modules/dashboard/people-widgets";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, money, shortDate } from "@/modules/crm/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sales reports" };

function Tile({ icon: Icon, label, children, hint, index }: { icon: typeof Trophy; label: string; children: React.ReactNode; hint: string; index: number }) {
  return (
    <Card className="motion-safe:animate-rise group p-5" style={{ animationDelay: `${index * 60}ms` }}>
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:-rotate-6"><Icon className="size-4.5" aria-hidden /></span>
      <p className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{children}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function Panel({ title, subtitle, delay, children, className }: { title: string; subtitle?: string; delay: number; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("motion-safe:animate-rise min-w-0 p-5 sm:p-6", className)} style={{ animationDelay: `${delay}ms` }}>
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

async function Reports({ params }: PageProps<"/[organizationSlug]/crm/reports">) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "crm.report.read")) return <PermissionDenied what="sales reports" />;
  const r = await getCrmReport(ctx);
  const base = `/${ctx.organization.slug}/crm`;
  const cur = r.currency;
  const maxMonth = Math.max(1, ...r.wonByMonth.map((m) => m.value));
  const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const openStages = r.pipeline.filter((s) => s.kind === "open");

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="Sales reports" description={`Counted from your deals and leads. Money is shown in ${cur}.`} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile index={0} icon={CircleDollarSign} label="Open pipeline" hint={`${r.openCount} open ${r.openCount === 1 ? "deal" : "deals"}`}>{money(r.openValue, cur, true)}</Tile>
        <Tile index={1} icon={Gauge} label="Weighted forecast" hint="Each deal × its stage's chance to win">{money(Math.round(r.weightedValue), cur, true)}</Tile>
        <Tile index={2} icon={Trophy} label="Won this month" hint={`${r.wonThisMonth.count} won · ${r.lostThisMonth} lost`}>{money(r.wonThisMonth.value, cur, true)}</Tile>
        <Tile index={3} icon={BadgePercent} label="Win rate" hint={r.averageWon === null ? "No deals won in 90 days" : `Average won deal ${money(r.averageWon, cur, true)}`}>
          {r.winRate === null ? "—" : <><CountUp value={r.winRate} delay={240} />%</>}
        </Tile>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <Panel title="Pipeline by stage" subtitle="Open deal value in each stage" delay={200} className="lg:col-span-3">
          {openStages.every((s) => s.count === 0) ? <p className="text-sm text-muted-foreground">No open deals yet.</p> : (
            <ul className="grid gap-3">
              {openStages.map((s, i) => {
                const max = Math.max(1, ...openStages.map((x) => x.value));
                return (
                  <li key={s.stageId} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{s.name} <span className="text-xs text-muted-foreground">· {s.count} · {s.probability}%</span></span>
                      <span className="font-medium tabular-nums">{money(s.value, cur, true)}</span>
                    </div>
                    <div className="h-6 overflow-hidden rounded-md bg-surface-muted" aria-hidden>
                      {s.value > 0 && <div className="h-full origin-left rounded-md bg-primary motion-safe:animate-grow-x" style={{ width: `${Math.max(3, (s.value / max) * 100)}%`, opacity: 1 - i * 0.12, animationDelay: `${300 + i * 80}ms` }} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Won by month" subtitle="Last 6 months" delay={260} className="lg:col-span-2">
          <ol className="flex h-48 items-end gap-2" aria-label="Won value by month">
            {r.wonByMonth.map((m, i) => (
              <li key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${monthLabel(m.month)}: ${money(m.value, cur)} from ${m.count} ${m.count === 1 ? "deal" : "deals"}`}>
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{m.value > 0 ? money(m.value, cur, true) : ""}</span>
                <span className={cn("w-full max-w-10 origin-bottom rounded-t-md motion-safe:animate-grow-y", m.value > 0 ? "bg-primary" : "bg-surface-muted")}
                  style={{ height: `${m.value > 0 ? Math.max(6, (m.value / maxMonth) * 100) : 3}%`, animationDelay: `${300 + i * 70}ms` }} />
                <span className={cn("text-xs", i === r.wonByMonth.length - 1 ? "font-semibold" : "text-muted-foreground")}>{monthLabel(m.month)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Leads by source" subtitle={`${r.newLeadsThisMonth} new this month`} delay={300}>
          {r.leadsBySource.length === 0 ? <p className="text-sm text-muted-foreground">No leads yet.</p>
            : <GrowBars delay={300} rows={r.leadsBySource.map((l) => ({ label: LEAD_SOURCE_LABELS[l.source], value: l.count }))} />}
        </Panel>
        <Panel title="Lead funnel" subtitle={r.conversionRate === null ? "No leads in 90 days" : `${r.conversionRate}% of leads from the last 90 days converted`} delay={340}>
          {r.leadsByStatus.length === 0 ? <p className="text-sm text-muted-foreground">No leads yet.</p> : (
            <GrowBars delay={340} rows={["new", "contacted", "qualified", "converted", "disqualified"].map((s) => ({ label: LEAD_STATUS_LABELS[s], value: r.leadsByStatus.find((x) => x.status === s)?.count ?? 0 }))} />
          )}
        </Panel>
        <Panel title="Closing soon" subtitle="Open deals expected to close within 2 weeks, or a week overdue" delay={380}>
          {r.closingSoon.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" aria-hidden />Nothing due right now.</p> : (
            <ul className="grid gap-3">
              {r.closingSoon.map((d) => (
                <li key={d.id}>
                  <Link href={`${base}/deals/${d.id}`} className="group flex items-center gap-3">
                    <span className="grid min-w-0 flex-1"><span className="truncate text-sm font-medium group-hover:underline">{d.title}</span><span className="truncate text-xs text-muted-foreground">{d.company ?? "No company"} · {shortDate(d.date)}</span></span>
                    <span className="text-sm font-semibold tabular-nums">{money(d.amount, d.currency, true)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {r.otherCurrencies.length > 0 && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Also open, in other currencies (not added to the totals above, since rates change): {r.otherCurrencies.map((o) => `${money(o.openValue, o.currency, true)} in ${o.count} ${o.count === 1 ? "deal" : "deals"}`).join(", ")}.
        </p>
      )}
    </div>
  );
}

export default function ReportsPage(props: PageProps<"/[organizationSlug]/crm/reports">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-48" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div><Skeleton className="h-72" /></div>}><Reports {...props} /></Suspense>;
}
