import "server-only";
import { getDb } from "@/server/database/client";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { docNumber } from "./shared";

/**
 * The finance overview, from the organization's own records only: issued
 * invoices, recorded payments and approved expenses. Amounts are in the
 * workspace currency; records in other currencies are counted, not converted.
 */
export interface FinanceOverview {
  currency: string;
  outstanding: number; outstandingCount: number;
  overdue: number; overdueCount: number;
  aging: { label: string; amount: number; count: number }[];
  thisMonth: { income: number; expenses: number; net: number };
  lastMonth: { income: number; expenses: number };
  months: { key: string; label: string; income: number; expenses: number }[];
  byCategory: { category: string; amount: number }[];
  topClients: { name: string; invoiced: number; paid: number }[];
  pendingExpenses: { count: number; amount: number };
  draftInvoices: number;
  openEstimates: { count: number; amount: number };
  recentPayments: { id: string; invoiceId: string; number: string; client: string; amount: number; paidOn: string; method: string }[];
  otherCurrencyRecords: number;
}

export async function getFinanceOverview(ctx: OrgContext): Promise<FinanceOverview> {
  assertPermission(ctx, "finance.report.read");
  const sql = getDb();
  const org = ctx.organizationId, cur = ctx.organization.currency, tz = ctx.organization.timezone;
  const today = sql`(now() at time zone ${tz})::date`;
  const [[recv], aging, months, cats, clients, [pending], [drafts], [estimates], payments, [other]] = await Promise.all([
    sql<{ outstanding: string; n: number; overdue: string; overdue_n: number }[]>`
      select coalesce(sum(total - amount_paid), 0) as outstanding, count(*)::int as n,
        coalesce(sum(total - amount_paid) filter (where due_date < ${today}), 0) as overdue,
        (count(*) filter (where due_date < ${today}))::int as overdue_n
      from finance_document
      where organization_id = ${org} and kind = 'invoice' and status = 'issued' and amount_paid < total and currency = ${cur}`,
    sql<{ bucket: number; amount: string; n: number }[]>`
      select case when due_date is null or due_date >= ${today} then 0
                  when ${today} - due_date <= 30 then 1 when ${today} - due_date <= 60 then 2
                  when ${today} - due_date <= 90 then 3 else 4 end as bucket,
        sum(total - amount_paid) as amount, count(*)::int as n
      from finance_document
      where organization_id = ${org} and kind = 'invoice' and status = 'issued' and amount_paid < total and currency = ${cur}
      group by 1`,
    sql<{ key: string; income: string; expenses: string }[]>`
      with m as (
        select to_char(date_trunc('month', ${today}) - make_interval(months => g), 'YYYY-MM') as key
        from generate_series(0, 5) g
      )
      select m.key,
        coalesce((select sum(p.amount) from finance_payment p join finance_document d on d.id = p.invoice_id and d.organization_id = p.organization_id
          where p.organization_id = ${org} and d.currency = ${cur} and to_char(p.paid_on, 'YYYY-MM') = m.key), 0) as income,
        coalesce((select sum(e.amount) from finance_expense e
          where e.organization_id = ${org} and e.currency = ${cur} and e.status in ('approved', 'paid') and to_char(e.spent_on, 'YYYY-MM') = m.key), 0) as expenses
      from m order by m.key`,
    sql<{ category: string; amount: string }[]>`
      select category, sum(amount) as amount from finance_expense
      where organization_id = ${org} and currency = ${cur} and status in ('approved', 'paid') and spent_on >= date_trunc('year', ${today})
      group by category order by 2 desc`,
    sql<{ name: string; invoiced: string; paid: string }[]>`
      select coalesce(c.name, d.bill_to_name) as name, sum(d.total) as invoiced, sum(d.amount_paid) as paid
      from finance_document d left join crm_company c on c.id = d.company_id and c.organization_id = d.organization_id
      where d.organization_id = ${org} and d.kind = 'invoice' and d.status = 'issued' and d.currency = ${cur} and d.issue_date >= date_trunc('year', ${today})
      group by 1 order by 2 desc limit 5`,
    sql<{ n: number; amount: string }[]>`
      select count(*)::int as n, coalesce(sum(amount) filter (where currency = ${cur}), 0) as amount from finance_expense where organization_id = ${org} and status = 'pending'`,
    sql<{ n: number }[]>`select count(*)::int as n from finance_document where organization_id = ${org} and kind = 'invoice' and status = 'draft'`,
    sql<{ n: number; amount: string }[]>`
      select count(*)::int as n, coalesce(sum(total) filter (where currency = ${cur}), 0) as amount from finance_document
      where organization_id = ${org} and kind = 'estimate' and status = 'sent'`,
    sql<{ id: string; invoice_id: string; number: number; client: string; amount: string; paid_on: string; method: string }[]>`
      select p.id, d.id as invoice_id, d.number, d.bill_to_name as client, p.amount, to_char(p.paid_on, 'YYYY-MM-DD') as paid_on, p.method
      from finance_payment p join finance_document d on d.id = p.invoice_id and d.organization_id = p.organization_id
      where p.organization_id = ${org} order by p.paid_on desc, p.created_at desc limit 6`,
    sql<{ n: number }[]>`
      select ((select count(*) from finance_document where organization_id = ${org} and currency <> ${cur} and status <> 'draft')
        + (select count(*) from finance_expense where organization_id = ${org} and currency <> ${cur}))::int as n`,
  ]);
  const AGING = ["Not due yet", "1–30 days late", "31–60 days late", "61–90 days late", "Over 90 days late"];
  const monthRows = months.map((m) => ({
    key: m.key,
    label: new Date(`${m.key}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    income: Number(m.income), expenses: Number(m.expenses),
  }));
  const tm = monthRows.at(-1)!, lm = monthRows.at(-2)!;
  return {
    currency: cur,
    outstanding: Number(recv.outstanding), outstandingCount: recv.n, overdue: Number(recv.overdue), overdueCount: recv.overdue_n,
    aging: AGING.map((label, i) => { const a = aging.find((x) => x.bucket === i); return { label, amount: a ? Number(a.amount) : 0, count: a?.n ?? 0 }; }),
    thisMonth: { income: tm.income, expenses: tm.expenses, net: Math.round((tm.income - tm.expenses) * 100) / 100 },
    lastMonth: { income: lm.income, expenses: lm.expenses },
    months: monthRows,
    byCategory: cats.map((c) => ({ category: c.category, amount: Number(c.amount) })),
    topClients: clients.map((c) => ({ name: c.name, invoiced: Number(c.invoiced), paid: Number(c.paid) })),
    pendingExpenses: { count: pending.n, amount: Number(pending.amount) },
    draftInvoices: drafts.n,
    openEstimates: { count: estimates.n, amount: Number(estimates.amount) },
    recentPayments: payments.map((p) => ({ id: p.id, invoiceId: p.invoice_id, number: docNumber("invoice", p.number), client: p.client, amount: Number(p.amount), paidOn: p.paid_on, method: p.method })),
    otherCurrencyRecords: other.n,
  };
}
