import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CircleDollarSign, Gauge, Handshake, Plus, Trophy } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listDeals, listStages } from "@/server/crm/deals";
import { listCompanies, listContacts, listCrmOwners } from "@/server/crm/contacts";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/modules/dashboard/people-widgets";
import { DealDialog } from "@/modules/crm/forms";
import { ListFilters } from "@/modules/crm/notes-ui";
import { PipelineBoard } from "@/modules/crm/pipeline-board";
import { money } from "@/modules/crm/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pipeline" };

function Kpi({ icon: Icon, label, value, sub, index }: { icon: typeof Trophy; label: string; value: React.ReactNode; sub?: string; index: number }) {
  return (
    <Card className="motion-safe:animate-rise group flex items-center gap-3 p-4" style={{ animationDelay: `${index * 60}ms` }}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:-rotate-6"><Icon className="size-5" aria-hidden /></span>
      <span className="grid min-w-0">
        <span className="truncate text-xl font-semibold tracking-tight">{value}</span>
        <span className="truncate text-xs text-muted-foreground">{label}{sub ? ` · ${sub}` : ""}</span>
      </span>
    </Card>
  );
}

async function Pipeline({ params, searchParams }: PageProps<"/[organizationSlug]/crm">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}/crm`;
  if (!can(ctx, "crm.deal.read")) {
    if (can(ctx, "crm.lead.read")) redirect(`${base}/leads`);
    if (can(ctx, "crm.contact.read")) redirect(`${base}/contacts`);
    return <PermissionDenied what="the CRM" />;
  }
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const mine = sp.owner === "me";
  const canCreate = can(ctx, "crm.deal.create");
  const [stages, deals, owners, companies, contacts] = await Promise.all([
    listStages(ctx),
    listDeals(ctx, { query, ownerMemberId: mine ? ctx.memberId : undefined }),
    listCrmOwners(ctx),
    canCreate && can(ctx, "crm.contact.read") ? listCompanies(ctx) : [],
    canCreate && can(ctx, "crm.contact.read") ? listContacts(ctx) : [],
  ]);

  const cur = ctx.organization.currency;
  const tz = ctx.organization.timezone;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const monthKey = today.slice(0, 7);
  const open = deals.filter((d) => d.stage.kind === "open");
  const openValue = open.filter((d) => d.currency === cur).reduce((a, d) => a + d.amount, 0);
  const weighted = open.filter((d) => d.currency === cur).reduce((a, d) => a + (d.amount * d.stage.probability) / 100, 0);
  const wonMonth = deals.filter((d) => d.stage.kind === "won" && d.closedAt && new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d.closedAt).startsWith(monthKey));
  const wonValue = wonMonth.filter((d) => d.currency === cur).reduce((a, d) => a + d.amount, 0);

  const newDeal = canCreate ? (
    <DealDialog slug={ctx.organization.slug} trigger={<Button><Plus />New deal</Button>} currency={cur}
      owners={owners} companies={companies.map((c) => ({ id: c.id, name: c.name }))} contacts={contacts.map((c) => ({ id: c.id, name: c.fullName }))}
      stages={stages.map((s) => ({ id: s.id, name: s.name }))} />
  ) : undefined;

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="Pipeline" description="Every open deal, stage by stage. Drag a card to move it." actions={newDeal} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi index={0} icon={Handshake} label="Open deals" value={<CountUp value={open.length} />} />
        <Kpi index={1} icon={CircleDollarSign} label="Pipeline value" value={money(openValue, cur, true)} />
        <Kpi index={2} icon={Gauge} label="Forecast" value={money(Math.round(weighted), cur, true)} />
        <Kpi index={3} icon={Trophy} label={`Won this month · ${wonMonth.length}`} value={money(wonValue, cur, true)} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1"><ListFilters placeholder="Search deals, companies or contacts" /></div>
        <div role="group" aria-label="Whose deals" className="inline-flex shrink-0 rounded-lg border border-border bg-surface p-0.5">
          {[{ k: "", l: "Everyone" }, { k: "me", l: "My deals" }].map((o) => (
            <Link key={o.l} href={o.k ? `${base}?owner=me${query ? `&q=${encodeURIComponent(query)}` : ""}` : `${base}${query ? `?q=${encodeURIComponent(query)}` : ""}`}
              aria-current={(o.k === "me") === mine ? "true" : undefined}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", (o.k === "me") === mine ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-surface-muted")}>{o.l}</Link>
          ))}
        </div>
      </div>
      <PipelineBoard slug={ctx.organization.slug} base={base} currency={cur} canMove={can(ctx, "crm.deal.update")}
        stages={stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind, probability: s.probability }))}
        deals={deals.map((d) => ({
          id: d.id, title: d.title, amount: d.amount, currency: d.currency, stageId: d.stage.id, expectedCloseDate: d.expectedCloseDate,
          company: d.company?.name ?? null, contact: d.contact?.name ?? null, owner: d.owner?.name ?? null,
          overdue: d.stage.kind === "open" && !!d.expectedCloseDate && d.expectedCloseDate < today,
        }))} />
      {deals.length === 0 && !query && !mine && (
        <p className="text-center text-sm text-muted-foreground">No deals yet. {canCreate ? "Add your first deal, or convert a qualified lead." : "Deals your team adds show up here."}</p>
      )}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      <div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80 w-[272px] shrink-0" />)}</div>
    </div>
  );
}

export default function PipelinePage(props: PageProps<"/[organizationSlug]/crm">) {
  return <Suspense fallback={<BoardSkeleton />}><Pipeline {...props} /></Suspense>;
}
