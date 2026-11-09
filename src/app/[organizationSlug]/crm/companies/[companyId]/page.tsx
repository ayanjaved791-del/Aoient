import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Factory, Globe, MapPin, Pencil, Phone, Plus, UserRound } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getCompany, listCompanies, listContacts, listCrmOwners } from "@/server/crm/contacts";
import { listDeals, listStages } from "@/server/crm/deals";
import { listNotes } from "@/server/crm/notes";
import { NotFoundError } from "@/lib/errors";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchiveButton, CompanyDialog, ContactDialog, DealDialog } from "@/modules/crm/forms";
import { Notes } from "@/modules/crm/notes-ui";
import { DealList } from "@/modules/crm/deal-list";
import { money } from "@/modules/crm/labels";
import { noteViews } from "@/modules/crm/view";

export const metadata: Metadata = { title: "Company" };

async function CompanyView({ params }: PageProps<"/[organizationSlug]/crm/companies/[companyId]">) {
  const { organizationSlug, companyId } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "crm.contact.read")) return <PermissionDenied what="companies" />;
  const co = await getCompany(ctx, companyId).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const base = `/${ctx.organization.slug}/crm`;
  const canManage = can(ctx, "crm.contact.manage");
  const seesDeals = can(ctx, "crm.deal.read");
  const canAddDeal = can(ctx, "crm.deal.create");
  const [contacts, deals, notes, owners, companies, stages] = await Promise.all([
    listContacts(ctx, { companyId: co.id }),
    seesDeals ? listDeals(ctx, { companyId: co.id }) : null,
    listNotes(ctx, "company", co.id),
    canManage || canAddDeal ? listCrmOwners(ctx) : [],
    canManage ? listCompanies(ctx) : [],
    canAddDeal ? listStages(ctx) : [],
  ]);
  const cur = ctx.organization.currency;
  const wonValue = (deals ?? []).filter((d) => d.stage.kind === "won" && d.currency === cur).reduce((a, d) => a + d.amount, 0);
  const openValue = (deals ?? []).filter((d) => d.stage.kind === "open" && d.currency === cur).reduce((a, d) => a + d.amount, 0);
  const site = co.website ? (co.website.startsWith("http") ? co.website : `https://${co.website}`) : null;
  const facts = [
    { icon: Factory, label: "Industry", value: co.industry ?? "Not set" },
    { icon: MapPin, label: "City", value: co.city ?? "Not set" },
    { icon: Globe, label: "Website", value: co.website ?? "Not set", href: site ?? undefined },
    { icon: Phone, label: "Phone", value: co.phone ?? "Not set", href: co.phone ? `tel:${co.phone.replace(/[^\d+]/g, "")}` : undefined },
    { icon: UserRound, label: "Owner", value: co.owner?.name ?? "No owner" },
  ];

  return (
    <div className="grid min-w-0 gap-6">
      <Link href={`${base}/companies`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Companies</Link>
      <Card className="motion-safe:animate-rise flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">{co.name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{co.name}{co.archived && <Badge className="ml-2 align-middle">Archived</Badge>}</h1>
          {seesDeals && <p className="text-sm text-muted-foreground">{money(openValue, cur)} in open deals · {money(wonValue, cur)} won</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canAddDeal && !co.archived && (
            <DealDialog slug={ctx.organization.slug} currency={cur} trigger={<Button><Plus />New deal</Button>}
              owners={owners} companies={[{ id: co.id, name: co.name }]} contacts={contacts.map((c) => ({ id: c.id, name: c.fullName }))}
              stages={stages.map((s) => ({ id: s.id, name: s.name }))} defaults={{ companyId: co.id }} />
          )}
          {canManage && (
            <CompanyDialog slug={ctx.organization.slug} owners={owners} trigger={<Button variant="secondary"><Pencil />Edit</Button>}
              company={{ id: co.id, name: co.name, website: co.website, industry: co.industry, phone: co.phone, city: co.city, ownerId: co.owner?.id ?? null }} />
          )}
        </div>
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-6">
          {deals && (
            <Card className="motion-safe:animate-rise p-5 [animation-delay:60ms] sm:p-6">
              <h2 className="text-base font-semibold">Deals</h2>
              <DealList base={base} deals={deals} empty="No deals with this company yet." />
            </Card>
          )}
          <Card className="motion-safe:animate-rise p-5 [animation-delay:100ms] sm:p-6">
            <h2 className="mb-4 text-base font-semibold">Notes</h2>
            <Notes slug={ctx.organization.slug} subjectType="company" subjectId={co.id} notes={noteViews(notes)} canWrite={canManage} />
          </Card>
        </div>
        <aside className="grid content-start gap-4">
          <Card className="motion-safe:animate-rise p-5 [animation-delay:120ms]">
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="mt-4 grid gap-3">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 text-sm">
                  <f.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <dt className="w-20 shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 truncate">{f.href ? <a href={f.href} target={f.label === "Website" ? "_blank" : undefined} rel="noopener noreferrer" className="font-medium hover:underline">{f.value}</a> : f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="motion-safe:animate-rise p-5 [animation-delay:160ms]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">People ({contacts.length})</h2>
              {canManage && !co.archived && (
                <ContactDialog slug={ctx.organization.slug} owners={owners} companies={companies.map((c) => ({ id: c.id, name: c.name }))} defaultCompanyId={co.id} defaultOwnerId={ctx.memberId}
                  trigger={<Button variant="ghost" size="sm"><Plus />Add</Button>} />
              )}
            </div>
            {contacts.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No contacts at this company yet.</p> : (
              <ul className="mt-3 grid gap-2.5">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <Link href={`${base}/contacts/${c.id}`} className="flex items-center gap-2.5 rounded-md hover:underline">
                      <Avatar name={c.fullName} size="sm" />
                      <span className="grid min-w-0"><span className="truncate text-sm font-medium">{c.fullName}</span><span className="truncate text-xs text-muted-foreground">{c.jobTitle ?? c.email ?? "—"}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {canManage && <div><ArchiveButton slug={ctx.organization.slug} kind="company" id={co.id} name={co.name} archived={co.archived} /></div>}
        </aside>
      </div>
    </div>
  );
}

export default function CompanyPage(props: PageProps<"/[organizationSlug]/crm/companies/[companyId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-5 w-24" /><Skeleton className="h-28" /><Skeleton className="h-72" /></div>}><CompanyView {...props} /></Suspense>;
}
