import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightLeft, Magnet, Pencil, Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listLeads, type LeadStatus } from "@/server/crm/leads";
import { listCrmOwners } from "@/server/crm/contacts";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchiveButton, ConvertLeadDialog, LeadDialog } from "@/modules/crm/forms";
import { ListFilters } from "@/modules/crm/notes-ui";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, money } from "@/modules/crm/labels";
import { timeAgo } from "@/lib/activity";

export const metadata: Metadata = { title: "Leads" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Open leads" }, { value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Not a fit" }, { value: "converted", label: "Converted" }, { value: "all", label: "All leads" }, { value: "archived", label: "Archived" },
];

async function Leads({ params, searchParams }: PageProps<"/[organizationSlug]/crm/leads">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "crm.lead.read")) return <PermissionDenied what="leads" />;
  const base = `/${ctx.organization.slug}/crm`;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const f = typeof sp.status === "string" ? sp.status : "";
  const archived = f === "archived";
  const status = (["new", "contacted", "qualified", "disqualified", "converted", "all"] as const).includes(f as never) ? (f as LeadStatus | "all") : archived ? "all" : "open";
  const canCreate = can(ctx, "crm.lead.create");
  const canEdit = can(ctx, "crm.lead.update");
  const canConvert = canEdit && can(ctx, "crm.contact.manage");
  const [leads, owners] = await Promise.all([listLeads(ctx, { status, query, archived }), canCreate || canEdit ? listCrmOwners(ctx) : []]);
  const now = new Date();
  const filtered = Boolean(query || f);
  const cur = ctx.organization.currency;

  const add = canCreate ? <LeadDialog slug={ctx.organization.slug} owners={owners} defaultOwnerId={ctx.memberId} trigger={<Button><Plus />New lead</Button>} /> : undefined;

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="Leads" description="People who might become customers. Qualify them, then convert the good ones into deals." actions={add} />
      <ListFilters placeholder="Search by name, email or company" select={{ key: "status", label: "Filter leads", options: FILTERS }} />
      <Card className="min-w-0 overflow-hidden">
        {leads.length === 0 ? (
          <EmptyState icon={Magnet} title={filtered ? "No leads match" : "No leads yet"}
            description={filtered ? "Try a different search or filter." : canCreate ? "Add people who showed interest: from your website, referrals or events." : "Leads your team adds show up here."}
            action={!filtered ? add : undefined} />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Lead</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Source</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Est. value</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Owner</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Added</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((l, i) => (
                  <tr key={l.id} className="motion-safe:animate-rise hover:bg-surface-muted/50" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={l.fullName} />
                        <span className="grid min-w-0">
                          <span className="truncate font-medium">{l.fullName}</span>
                          <span className="truncate text-xs text-muted-foreground">{[l.companyName, l.email].filter(Boolean).join(" · ") || "No company or email"}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary-foreground">{LEAD_SOURCE_LABELS[l.source]}</td>
                    <td className="px-4 py-3"><Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Badge></td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.estimatedValue === null ? "—" : money(l.estimatedValue, cur)}</td>
                    <td className="px-4 py-3 text-secondary-foreground">{l.owner?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground"><time dateTime={l.createdAt.toISOString()}>{timeAgo(l.createdAt, now)}</time></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {l.status === "converted" ? (
                          l.convertedDealId && can(ctx, "crm.deal.read")
                            ? <Button variant="ghost" size="sm" asChild><Link href={`${base}/deals/${l.convertedDealId}`}>Open deal</Link></Button>
                            : l.convertedContactId && can(ctx, "crm.contact.read") ? <Button variant="ghost" size="sm" asChild><Link href={`${base}/contacts/${l.convertedContactId}`}>Open contact</Link></Button> : null
                        ) : (
                          <>
                            {canConvert && !l.archived && (
                              <ConvertLeadDialog slug={ctx.organization.slug} base={base} currency={cur} canCreateDeal={can(ctx, "crm.deal.create")}
                                lead={{ id: l.id, fullName: l.fullName, companyName: l.companyName, estimatedValue: l.estimatedValue }}
                                trigger={<Button variant="secondary" size="sm"><ArrowRightLeft />Convert</Button>} />
                            )}
                            {canEdit && !l.archived && (
                              <LeadDialog slug={ctx.organization.slug} owners={owners}
                                lead={{ id: l.id, fullName: l.fullName, email: l.email, phone: l.phone, companyName: l.companyName, source: l.source, status: l.status, estimatedValue: l.estimatedValue, ownerId: l.owner?.id ?? null }}
                                trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${l.fullName}`}><Pencil /></Button>} />
                            )}
                            {can(ctx, "crm.lead.archive") && <ArchiveButton slug={ctx.organization.slug} kind="lead" id={l.id} name={l.fullName} archived={l.archived} />}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {leads.length > 0 && <p className="text-xs text-muted-foreground">{leads.length} {leads.length === 1 ? "lead" : "leads"}</p>}
    </div>
  );
}

export default function LeadsPage(props: PageProps<"/[organizationSlug]/crm/leads">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-10" /><Skeleton className="h-96" /></div>}><Leads {...props} /></Suspense>;
}
