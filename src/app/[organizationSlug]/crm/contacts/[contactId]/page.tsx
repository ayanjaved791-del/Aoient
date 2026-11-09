import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Briefcase, Building2, Mail, Pencil, Phone, Plus, UserRound } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getContact, listCompanies, listCrmOwners } from "@/server/crm/contacts";
import { listDeals, listStages } from "@/server/crm/deals";
import { listNotes } from "@/server/crm/notes";
import { NotFoundError } from "@/lib/errors";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchiveButton, ContactDialog, DealDialog } from "@/modules/crm/forms";
import { Notes } from "@/modules/crm/notes-ui";
import { DealList } from "@/modules/crm/deal-list";
import { noteViews } from "@/modules/crm/view";

export const metadata: Metadata = { title: "Contact" };

async function ContactView({ params }: PageProps<"/[organizationSlug]/crm/contacts/[contactId]">) {
  const { organizationSlug, contactId } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "crm.contact.read")) return <PermissionDenied what="contacts" />;
  const c = await getContact(ctx, contactId).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const base = `/${ctx.organization.slug}/crm`;
  const canManage = can(ctx, "crm.contact.manage");
  const seesDeals = can(ctx, "crm.deal.read");
  const canAddDeal = can(ctx, "crm.deal.create");
  const [notes, deals, owners, companies, stages] = await Promise.all([
    listNotes(ctx, "contact", c.id),
    seesDeals ? listDeals(ctx, { contactId: c.id }) : null,
    canManage || canAddDeal ? listCrmOwners(ctx) : [],
    canManage || canAddDeal ? listCompanies(ctx) : [],
    canAddDeal ? listStages(ctx) : [],
  ]);
  const companyOpts = companies.map((x) => ({ id: x.id, name: x.name }));
  const facts = [
    { icon: Briefcase, label: "Job title", value: c.jobTitle ?? "Not set" },
    { icon: Building2, label: "Company", value: c.company?.name ?? "None", href: c.company ? `${base}/companies/${c.company.id}` : undefined },
    { icon: Mail, label: "Email", value: c.email ?? "Not set", href: c.email ? `mailto:${c.email}` : undefined },
    { icon: Phone, label: "Phone", value: c.phone ?? "Not set", href: c.phone ? `tel:${c.phone.replace(/[^\d+]/g, "")}` : undefined },
    { icon: UserRound, label: "Owner", value: c.owner?.name ?? "No owner" },
  ];

  return (
    <div className="grid min-w-0 gap-6">
      <Link href={`${base}/contacts`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Contacts</Link>
      <Card className="motion-safe:animate-rise flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <Avatar name={c.fullName} size="lg" className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{c.fullName}</h1>
          <p className="text-sm text-muted-foreground">{[c.jobTitle, c.company?.name].filter(Boolean).join(" at ") || "Contact"}{c.archived && <Badge className="ml-2">Archived</Badge>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAddDeal && !c.archived && (
            <DealDialog slug={ctx.organization.slug} currency={ctx.organization.currency} trigger={<Button><Plus />New deal</Button>}
              owners={owners} companies={companyOpts} contacts={[{ id: c.id, name: c.fullName }]} stages={stages.map((s) => ({ id: s.id, name: s.name }))}
              defaults={{ contactId: c.id, companyId: c.company?.id }} />
          )}
          {canManage && (
            <ContactDialog slug={ctx.organization.slug} owners={owners} companies={companyOpts} trigger={<Button variant="secondary"><Pencil />Edit</Button>}
              contact={{ id: c.id, fullName: c.fullName, email: c.email, phone: c.phone, jobTitle: c.jobTitle, companyId: c.company?.id ?? null, ownerId: c.owner?.id ?? null }} />
          )}
        </div>
      </Card>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-6">
          {deals && (
            <Card className="motion-safe:animate-rise p-5 [animation-delay:60ms] sm:p-6">
              <h2 className="text-base font-semibold">Deals</h2>
              <DealList base={base} deals={deals} empty="No deals with this contact yet." />
            </Card>
          )}
          <Card className="motion-safe:animate-rise p-5 [animation-delay:100ms] sm:p-6">
            <h2 className="mb-4 text-base font-semibold">Notes</h2>
            <Notes slug={ctx.organization.slug} subjectType="contact" subjectId={c.id} notes={noteViews(notes)} canWrite={canManage} />
          </Card>
        </div>
        <aside className="grid content-start gap-4">
          <Card className="motion-safe:animate-rise p-5 [animation-delay:120ms]">
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="mt-4 grid gap-3">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 text-sm">
                  <f.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <dt className="w-24 shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 truncate">{f.href ? <a href={f.href} className="font-medium hover:underline">{f.value}</a> : f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {canManage && <div><ArchiveButton slug={ctx.organization.slug} kind="contact" id={c.id} name={c.fullName} archived={c.archived} /></div>}
        </aside>
      </div>
    </div>
  );
}

export default function ContactPage(props: PageProps<"/[organizationSlug]/crm/contacts/[contactId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-5 w-24" /><Skeleton className="h-28" /><Skeleton className="h-72" /></div>}><ContactView {...props} /></Suspense>;
}
