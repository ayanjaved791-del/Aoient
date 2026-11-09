import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, MapPin, Plus, UsersRound } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listCompanies, listCrmOwners } from "@/server/crm/contacts";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyDialog } from "@/modules/crm/forms";
import { ListFilters } from "@/modules/crm/notes-ui";

export const metadata: Metadata = { title: "Companies" };

async function Companies({ params, searchParams }: PageProps<"/[organizationSlug]/crm/companies">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "crm.contact.read")) return <PermissionDenied what="companies" />;
  const base = `/${ctx.organization.slug}/crm`;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const archived = sp.show === "archived";
  const canManage = can(ctx, "crm.contact.manage");
  const [companies, owners] = await Promise.all([listCompanies(ctx, { query, archived }), canManage ? listCrmOwners(ctx) : []]);
  const filtered = Boolean(query || archived);
  const add = canManage ? <CompanyDialog slug={ctx.organization.slug} owners={owners} defaultOwnerId={ctx.memberId} trigger={<Button><Plus />New company</Button>} /> : undefined;

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="Companies" description="Businesses you sell to, with their people and deals." actions={add} />
      <ListFilters placeholder="Search by name, industry or city" select={{ key: "show", label: "Show", options: [{ value: "", label: "Active" }, { value: "archived", label: "Archived" }] }} />
      {companies.length === 0 ? (
        <Card><EmptyState icon={Building2} title={filtered ? "No companies match" : "No companies yet"}
          description={filtered ? "Try a different search." : "Add companies here, or convert a lead that names one."} action={!filtered ? add : undefined} /></Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((c, i) => (
            <li key={c.id} className="motion-safe:animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <Link href={`${base}/companies/${c.id}`} className="group block h-full rounded-xl">
                <Card className="flex h-full flex-col p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform group-hover:-rotate-6">{c.name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{c.industry ?? "No industry set"}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><UsersRound className="size-3.5" aria-hidden />{c.contactCount} {c.contactCount === 1 ? "contact" : "contacts"}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">{c.openDeals} open {c.openDeals === 1 ? "deal" : "deals"}</span>
                    {c.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{c.city}</span>}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CompaniesPage(props: PageProps<"/[organizationSlug]/crm/companies">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-10" /><div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div></div>}><Companies {...props} /></Suspense>;
}
