import "server-only";
import { getDb } from "@/server/database/client";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import type { LeadSource, LeadStatus } from "./leads";
import { ensureStages } from "./shared";

/**
 * Sales numbers, counted from this organization's deals and leads only.
 * Money is reported in the organization's currency; deals in other
 * currencies are counted but their amounts are listed separately, never
 * converted with made-up rates.
 */
export interface CrmReport {
  currency: string;
  pipeline: { stageId: string; name: string; kind: "open" | "won" | "lost"; probability: number; count: number; value: number }[];
  openValue: number;
  weightedValue: number;
  openCount: number;
  wonThisMonth: { count: number; value: number };
  lostThisMonth: number;
  /** Won ÷ (won + lost) for deals closed in the last 90 days; null when none closed. */
  winRate: number | null;
  averageWon: number | null;
  closingSoon: { id: string; title: string; amount: number; currency: string; date: string; company: string | null }[];
  leadsBySource: { source: LeadSource; count: number }[];
  leadsByStatus: { status: LeadStatus; count: number }[];
  newLeadsThisMonth: number;
  /** Converted ÷ all leads created in the last 90 days; null when none. */
  conversionRate: number | null;
  otherCurrencies: { currency: string; openValue: number; count: number }[];
  wonByMonth: { month: string; value: number; count: number }[];
}

export async function getCrmReport(ctx: OrgContext): Promise<CrmReport> {
  assertPermission(ctx, "crm.report.read");
  const sql = getDb();
  const org = ctx.organizationId;
  const cur = ctx.organization.currency;
  const tz = ctx.organization.timezone;
  await ensureStages(sql, org);
  const monthStart = sql`(date_trunc('month', now() at time zone ${tz}) at time zone ${tz})`;

  const [pipeline, [won], [lost], [rate], closing, sources, statuses, [leads], others, months] = await Promise.all([
    sql<{ stage_id: string; name: string; kind: "open" | "won" | "lost"; probability: number; count: number; value: string }[]>`
      select s.id as stage_id, s.name, s.kind, s.probability,
        count(d.id)::int as count,
        coalesce(sum(d.amount) filter (where d.currency = ${cur}), 0) as value
      from crm_stage s
      left join crm_deal d on d.stage_id = s.id and d.organization_id = s.organization_id and d.archived_at is null
      where s.organization_id = ${org}
      group by s.id order by s.position`,
    sql<{ count: number; value: string }[]>`
      select count(*)::int as count, coalesce(sum(d.amount) filter (where d.currency = ${cur}), 0) as value
      from crm_deal d join crm_stage s on s.id = d.stage_id
      where d.organization_id = ${org} and d.archived_at is null and s.kind = 'won' and d.closed_at >= ${monthStart}`,
    sql<{ count: number }[]>`
      select count(*)::int as count from crm_deal d join crm_stage s on s.id = d.stage_id
      where d.organization_id = ${org} and d.archived_at is null and s.kind = 'lost' and d.closed_at >= ${monthStart}`,
    sql<{ won: number; lost: number; avg_won: string | null }[]>`
      select count(*) filter (where s.kind = 'won')::int as won, count(*) filter (where s.kind = 'lost')::int as lost,
        avg(d.amount) filter (where s.kind = 'won' and d.currency = ${cur}) as avg_won
      from crm_deal d join crm_stage s on s.id = d.stage_id
      where d.organization_id = ${org} and d.archived_at is null and d.closed_at >= now() - interval '90 days'`,
    sql<{ id: string; title: string; amount: string; currency: string; date: string; company: string | null }[]>`
      select d.id, d.title, d.amount, d.currency, to_char(d.expected_close_date, 'YYYY-MM-DD') as date, c.name as company
      from crm_deal d join crm_stage s on s.id = d.stage_id
      left join crm_company c on c.id = d.company_id and c.organization_id = d.organization_id
      where d.organization_id = ${org} and d.archived_at is null and s.kind = 'open'
        and d.expected_close_date between (now() at time zone ${tz})::date - 7 and (now() at time zone ${tz})::date + 14
      order by d.expected_close_date limit 8`,
    sql<{ source: LeadSource; count: number }[]>`
      select source, count(*)::int as count from crm_lead where organization_id = ${org} and archived_at is null group by 1 order by 2 desc`,
    sql<{ status: LeadStatus; count: number }[]>`
      select status, count(*)::int as count from crm_lead where organization_id = ${org} and archived_at is null group by 1`,
    sql<{ new_month: number; recent: number; converted: number }[]>`
      select count(*) filter (where created_at >= ${monthStart})::int as new_month,
        count(*) filter (where created_at >= now() - interval '90 days')::int as recent,
        count(*) filter (where created_at >= now() - interval '90 days' and status = 'converted')::int as converted
      from crm_lead where organization_id = ${org}`,
    sql<{ currency: string; value: string; count: number }[]>`
      select d.currency, coalesce(sum(d.amount), 0) as value, count(*)::int as count
      from crm_deal d join crm_stage s on s.id = d.stage_id
      where d.organization_id = ${org} and d.archived_at is null and s.kind = 'open' and d.currency <> ${cur}
      group by 1 order by 1`,
    sql<{ month: string; value: string; count: number }[]>`
      select to_char(m.month, 'YYYY-MM') as month,
        coalesce(sum(d.amount) filter (where d.currency = ${cur}), 0) as value, count(d.id)::int as count
      from generate_series(date_trunc('month', now() at time zone ${tz}) - interval '5 months', date_trunc('month', now() at time zone ${tz}), interval '1 month') as m(month)
      left join crm_deal d on d.organization_id = ${org} and d.archived_at is null
        and d.stage_id in (select id from crm_stage where organization_id = ${org} and kind = 'won')
        and date_trunc('month', d.closed_at at time zone ${tz}) = m.month
      group by m.month order by m.month`,
  ]);

  const stages = pipeline.map((p) => ({ stageId: p.stage_id, name: p.name, kind: p.kind, probability: p.probability, count: p.count, value: Number(p.value) }));
  const open = stages.filter((s) => s.kind === "open");
  const closed = rate.won + rate.lost;
  return {
    currency: cur,
    pipeline: stages,
    openValue: open.reduce((a, s) => a + s.value, 0),
    weightedValue: Math.round(open.reduce((a, s) => a + (s.value * s.probability) / 100, 0) * 100) / 100,
    openCount: open.reduce((a, s) => a + s.count, 0),
    wonThisMonth: { count: won.count, value: Number(won.value) },
    lostThisMonth: lost.count,
    winRate: closed ? Math.round((rate.won / closed) * 100) : null,
    averageWon: rate.avg_won === null ? null : Math.round(Number(rate.avg_won) * 100) / 100,
    closingSoon: closing.map((c) => ({ ...c, amount: Number(c.amount) })),
    leadsBySource: sources,
    leadsByStatus: statuses,
    newLeadsThisMonth: leads.new_month,
    conversionRate: leads.recent ? Math.round((leads.converted / leads.recent) * 100) : null,
    otherCurrencies: others.map((o) => ({ currency: o.currency, openValue: Number(o.value), count: o.count })),
    wonByMonth: months.map((m) => ({ month: m.month, value: Number(m.value), count: m.count })),
  };
}
