import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Building2, CalendarDays, CircleDollarSign, Pencil, UserRound, UsersRound } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getDeal, listStages } from "@/server/crm/deals";
import { listCompanies, listContacts, listCrmOwners } from "@/server/crm/contacts";
import { listNotes } from "@/server/crm/notes";
import { projectIdForDeal } from "@/server/projects/projects";
import { StartProjectButton } from "@/modules/projects/forms";
import { NotFoundError } from "@/lib/errors";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchiveButton, DealDialog } from "@/modules/crm/forms";
import { DealStepper } from "@/modules/crm/deal-stepper";
import { Notes } from "@/modules/crm/notes-ui";
import { money, shortDate } from "@/modules/crm/labels";
import { noteViews } from "@/modules/crm/view";

export const metadata: Metadata = { title: "Deal" };

async function Deal({ params }: PageProps<"/[organizationSlug]/crm/deals/[dealId]">) {
  const { organizationSlug, dealId } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "crm.deal.read")) return <PermissionDenied what="deals" />;
  const deal = await getDeal(ctx, dealId).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const base = `/${ctx.organization.slug}/crm`;
  const canEdit = can(ctx, "crm.deal.update");
  const seesContacts = can(ctx, "crm.contact.read");
  const [stages, notes, owners, companies, contacts, projectId] = await Promise.all([
    listStages(ctx),
    listNotes(ctx, "deal", deal.id),
    canEdit ? listCrmOwners(ctx) : [],
    canEdit && seesContacts ? listCompanies(ctx) : [],
    canEdit && seesContacts ? listContacts(ctx) : [],
    projectIdForDeal(ctx, deal.id),
  ]);
  const canStartProject = deal.stage.kind === "won" && !deal.archived && can(ctx, "projects.project.create");
  const facts = [
    { icon: CircleDollarSign, label: "Amount", value: money(deal.amount, deal.currency) },
    { icon: CalendarDays, label: deal.closedAt ? "Closed" : "Expected close", value: deal.closedAt ? shortDate(deal.closedAt.toISOString().slice(0, 10)) : deal.expectedCloseDate ? shortDate(deal.expectedCloseDate) : "Not set" },
    { icon: Building2, label: "Company", value: deal.company?.name ?? "None", href: deal.company && seesContacts ? `${base}/companies/${deal.company.id}` : undefined },
    { icon: UsersRound, label: "Contact", value: deal.contact?.name ?? "None", href: deal.contact && seesContacts ? `${base}/contacts/${deal.contact.id}` : undefined },
    { icon: UserRound, label: "Owner", value: deal.owner?.name ?? "No owner" },
  ];

  return (
    <div className="grid min-w-0 gap-6">
      <Link href={base} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Pipeline</Link>
      <Card className="motion-safe:animate-rise overflow-hidden">
        <div className="relative bg-navy px-6 py-6 text-white dark:bg-[#161616]">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.1)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_left,black,transparent_80%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/10 text-white">{deal.stage.name}</Badge>
                {deal.stage.kind === "won" && <Badge tone="success">Won</Badge>}
                {deal.stage.kind === "lost" && <Badge tone="danger">Lost</Badge>}
                {deal.archived && <Badge>Archived</Badge>}
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{deal.title}</h1>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{money(deal.amount, deal.currency)}</p>
            </div>
            {(canEdit || projectId || canStartProject) && (
              <div className="flex flex-wrap gap-2">
                {(projectId || canStartProject) && <StartProjectButton slug={ctx.organization.slug} dealId={deal.id} existingId={projectId} />}
                {canEdit && (
                <DealDialog slug={ctx.organization.slug} currency={ctx.organization.currency}
                  trigger={<Button variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Pencil />Edit</Button>}
                  owners={owners} companies={companies.map((c) => ({ id: c.id, name: c.name }))} contacts={contacts.map((c) => ({ id: c.id, name: c.fullName }))}
                  stages={stages.map((s) => ({ id: s.id, name: s.name }))}
                  deal={{ id: deal.id, title: deal.title, stageId: deal.stage.id, amount: deal.amount, currency: deal.currency, expectedCloseDate: deal.expectedCloseDate,
                    companyId: deal.company?.id ?? null, contactId: deal.contact?.id ?? null, ownerId: deal.owner?.id ?? null }} />
                )}
              </div>
            )}
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <DealStepper slug={ctx.organization.slug} dealId={deal.id} title={deal.title} stageId={deal.stage.id} canMove={canEdit && !deal.archived}
            stages={stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind }))} />
          {deal.lostReason && <p className="mt-3 text-sm text-muted-foreground">Lost because: {deal.lostReason}</p>}
        </div>
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="motion-safe:animate-rise p-5 [animation-delay:80ms] sm:p-6">
          <h2 className="text-base font-semibold">Notes</h2>
          <p className="mb-4 mt-0.5 text-sm text-muted-foreground">Calls, meetings and next steps for this deal.</p>
          <Notes slug={ctx.organization.slug} subjectType="deal" subjectId={deal.id} notes={noteViews(notes)} canWrite={canEdit} />
        </Card>
        <aside className="grid content-start gap-4">
          <Card className="motion-safe:animate-rise p-5 [animation-delay:120ms]">
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="mt-4 grid gap-3">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 text-sm">
                  <f.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <dt className="w-28 shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 truncate">{f.href ? <Link href={f.href} className="font-medium hover:underline">{f.value}</Link> : f.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Created {shortDate(deal.createdAt.toISOString().slice(0, 10))} · updated {shortDate(deal.updatedAt.toISOString().slice(0, 10))}</p>
          </Card>
          {canEdit && <div><ArchiveButton slug={ctx.organization.slug} kind="deal" id={deal.id} name={deal.title} archived={deal.archived} after={deal.archived ? undefined : base} /></div>}
        </aside>
      </div>
    </div>
  );
}

export default function DealPage(props: PageProps<"/[organizationSlug]/crm/deals/[dealId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-5 w-24" /><Skeleton className="h-56" /><Skeleton className="h-72" /></div>}><Deal {...props} /></Suspense>;
}
