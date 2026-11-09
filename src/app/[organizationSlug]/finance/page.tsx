import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, FileText, Plus, Receipt, Wallet } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getFinanceOverview } from "@/server/finance/reports";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, amount, day } from "@/modules/finance/labels";
import { money } from "@/modules/crm/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Finance" };

function Trend({ now, before }: { now: number; before: number }) {
  if (before === 0 && now === 0) return null;
  if (before === 0) return <span className="text-xs text-muted-foreground">first this period</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", pct >= 0 ? "text-success" : "text-danger")}><Icon className="size-3.5" aria-hidden />{Math.abs(pct)}% vs last month</span>;
}

async function Overview({ params }: PageProps<"/[organizationSlug]/finance">) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}/finance`;
  if (!can(ctx, "finance.report.read")) {
    if (can(ctx, "finance.invoice.read")) redirect(`${base}/invoices`);
    if (can(ctx, "finance.expense.read") || can(ctx, "finance.expense.manage") || can(ctx, "finance.expense.approve")) redirect(`${base}/expenses`);
    if (can(ctx, "finance.vendor.manage")) redirect(`${base}/vendors`);
    return <PermissionDenied what="finance" />;
  }
  const o = await getFinanceOverview(ctx);
  const c = o.currency;
  const maxMonth = Math.max(1, ...o.months.flatMap((m) => [m.income, m.expenses]));
  const maxAging = Math.max(1, ...o.aging.map((a) => a.amount));
  const maxCat = Math.max(1, ...o.byCategory.map((x) => x.amount));
  const kpis = [
    { label: "Owed to you", value: amount(o.outstanding, c), sub: `${o.outstandingCount} unpaid invoice${o.outstandingCount === 1 ? "" : "s"}`, href: `${base}/invoices?status=unpaid` },
    { label: "Overdue", value: amount(o.overdue, c), sub: `${o.overdueCount} past the due date`, href: `${base}/invoices?status=overdue`, danger: o.overdue > 0 },
    { label: "Received this month", value: amount(o.thisMonth.income, c), trend: <Trend now={o.thisMonth.income} before={o.lastMonth.income} /> },
    { label: "Spent this month", value: amount(o.thisMonth.expenses, c), sub: `Net ${amount(o.thisMonth.net, c)}` },
  ];
  const actions = (
    <div className="flex flex-wrap gap-2">
      {can(ctx, "finance.invoice.create") && <Button asChild><Link href={`${base}/invoices/new`}><Plus />New invoice</Link></Button>}
      {can(ctx, "finance.invoice.create") && <Button asChild variant="secondary"><Link href={`${base}/estimates/new`}><FileText />New estimate</Link></Button>}
    </div>
  );
  const todo = [
    { show: o.draftInvoices > 0, icon: FileText, text: `${o.draftInvoices} draft invoice${o.draftInvoices === 1 ? "" : "s"} not issued yet`, href: `${base}/invoices?status=draft` },
    { show: o.pendingExpenses.count > 0, icon: Receipt, text: `${o.pendingExpenses.count} expense${o.pendingExpenses.count === 1 ? "" : "s"} waiting for approval`, href: `${base}/expenses?status=pending` },
    { show: o.openEstimates.count > 0, icon: Wallet, text: `${o.openEstimates.count} estimate${o.openEstimates.count === 1 ? "" : "s"} waiting for an answer (${amount(o.openEstimates.amount, c)})`, href: `${base}/estimates?status=sent` },
    { show: o.overdueCount > 0, icon: AlertTriangle, text: `${o.overdueCount} overdue invoice${o.overdueCount === 1 ? "" : "s"} to chase`, href: `${base}/invoices?status=overdue` },
  ].filter((t) => t.show);

  return (
    <>
      <PageHeader title="Finance" description={`Money in and out, from your own invoices, payments and expenses. Amounts in ${c}.`} actions={actions} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => {
          const body = (
            <Card className={cn("motion-safe:animate-rise h-full p-4 transition-colors", k.href && "hover:border-primary/40")} style={{ animationDelay: `${i * 50}ms` }}>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={cn("mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl", k.danger && "text-danger")}>{k.value}</p>
              <div className="mt-1 truncate text-xs text-muted-foreground">{k.trend ?? k.sub}</div>
            </Card>
          );
          return k.href ? <Link key={k.label} href={k.href} className="block rounded-xl">{body}</Link> : <div key={k.label}>{body}</div>;
        })}
      </div>

      {todo.length > 0 && (
        <Card className="motion-safe:animate-rise divide-y divide-border overflow-hidden [animation-delay:120ms]">
          {todo.map((t) => (
            <Link key={t.text} href={t.href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-muted/50">
              <t.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />{t.text}<ArrowUpRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </Card>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="motion-safe:animate-rise min-w-0 p-5 [animation-delay:160ms] sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Money in and out</h2>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" aria-hidden />Received</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted-foreground/40" aria-hidden />Spent</span>
            </div>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">Payments received and approved expenses, last 6 months.</p>
          <div className="mt-6 grid h-48 grid-cols-6 items-end gap-2 sm:gap-4" role="list" aria-label="Money in and out by month">
            {o.months.map((m, i) => (
              <div key={m.key} role="listitem" className="grid h-full grid-rows-[1fr_auto] gap-2" aria-label={`${m.label}: received ${amount(m.income, c)}, spent ${amount(m.expenses, c)}`}>
                <div className="flex items-end justify-center gap-1">
                  <div title={`Received ${amount(m.income, c)}`} className="w-1/2 max-w-6 origin-bottom rounded-t bg-primary motion-safe:animate-grow-y" style={{ height: `${Math.max(m.income ? 3 : 0, (m.income / maxMonth) * 100)}%`, animationDelay: `${200 + i * 60}ms` }} />
                  <div title={`Spent ${amount(m.expenses, c)}`} className="w-1/2 max-w-6 origin-bottom rounded-t bg-muted-foreground/40 motion-safe:animate-grow-y" style={{ height: `${Math.max(m.expenses ? 3 : 0, (m.expenses / maxMonth) * 100)}%`, animationDelay: `${240 + i * 60}ms` }} />
                </div>
                <span className="text-center text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Six months: received <span className="font-medium text-foreground">{money(o.months.reduce((s, m) => s + m.income, 0), c)}</span>, spent <span className="font-medium text-foreground">{money(o.months.reduce((s, m) => s + m.expenses, 0), c)}</span>.</p>
        </Card>

        <Card className="motion-safe:animate-rise p-5 [animation-delay:200ms]">
          <h2 className="text-base font-semibold">Who owes what, by age</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Unpaid issued invoices.</p>
          <ul className="mt-4 grid gap-3">
            {o.aging.map((a, i) => (
              <li key={a.label} className="grid gap-1">
                <div className="flex justify-between gap-2 text-sm"><span className={cn(i >= 2 && a.amount > 0 && "text-danger")}>{a.label}</span><span className="tabular-nums">{amount(a.amount, c)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                  {a.amount > 0 && <div className={cn("h-full origin-left rounded-full motion-safe:animate-grow-x", i === 0 ? "bg-primary" : i === 1 ? "bg-warning" : "bg-danger")} style={{ width: `${(a.amount / maxAging) * 100}%`, animationDelay: `${300 + i * 60}ms` }} />}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-3">
        <Card className="motion-safe:animate-rise p-5 [animation-delay:240ms]">
          <h2 className="text-sm font-semibold">Spending by category</h2>
          <p className="text-xs text-muted-foreground">Approved expenses this year</p>
          {o.byCategory.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No approved expenses this year.</p> : (
            <ul className="mt-4 grid gap-2.5">
              {o.byCategory.slice(0, 6).map((x, i) => (
                <li key={x.category} className="grid gap-1">
                  <div className="flex justify-between gap-2 text-sm"><span>{EXPENSE_CATEGORY_LABELS[x.category] ?? x.category}</span><span className="tabular-nums text-muted-foreground">{money(x.amount, c)}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden><div className="h-full origin-left rounded-full bg-primary motion-safe:animate-grow-x" style={{ width: `${(x.amount / maxCat) * 100}%`, animationDelay: `${320 + i * 50}ms` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="motion-safe:animate-rise p-5 [animation-delay:280ms]">
          <h2 className="text-sm font-semibold">Top clients</h2>
          <p className="text-xs text-muted-foreground">Invoiced this year</p>
          {o.topClients.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No issued invoices this year.</p> : (
            <ol className="mt-4 grid gap-3">
              {o.topClients.map((t, i) => (
                <li key={t.name} className="flex items-center gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-muted text-xs font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="text-right tabular-nums"><span className="block font-medium">{money(t.invoiced, c)}</span><span className="block text-xs text-muted-foreground">{money(t.paid, c)} paid</span></span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card className="motion-safe:animate-rise p-5 [animation-delay:320ms]">
          <h2 className="text-sm font-semibold">Latest payments</h2>
          <p className="text-xs text-muted-foreground">Recorded against invoices</p>
          {o.recentPayments.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No payments recorded yet.</p> : (
            <ul className="mt-4 grid gap-3">
              {o.recentPayments.map((p) => (
                <li key={p.id} className="text-sm">
                  <Link href={`${base}/invoices/${p.invoiceId}`} className="flex items-center gap-2 hover:underline">
                    <span className="min-w-0 flex-1 truncate">{p.client}</span><span className="font-medium tabular-nums text-success">+{amount(p.amount, c)}</span>
                  </Link>
                  <p className="text-xs text-muted-foreground">{p.number} · {day(p.paidOn)} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {o.otherCurrencyRecords > 0 && (
        <p className="text-xs text-muted-foreground">{o.otherCurrencyRecords} record{o.otherCurrencyRecords === 1 ? " is" : "s are"} in another currency and {o.otherCurrencyRecords === 1 ? "isn't" : "aren't"} included in these {c} totals.</p>
      )}
    </>
  );
}

export default function FinancePage(props: PageProps<"/[organizationSlug]/finance">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-72" /></div>}><Overview {...props} /></Suspense>;
}
