import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Contact, Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listCompanies, listContacts, listCrmOwners } from "@/server/crm/contacts";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactDialog } from "@/modules/crm/forms";
import { ListFilters } from "@/modules/crm/notes-ui";

export const metadata: Metadata = { title: "Contacts" };

async function Contacts({ params, searchParams }: PageProps<"/[organizationSlug]/crm/contacts">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "crm.contact.read")) return <PermissionDenied what="contacts" />;
  const base = `/${ctx.organization.slug}/crm`;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const archived = sp.show === "archived";
  const canManage = can(ctx, "crm.contact.manage");
  const [contacts, companies, owners] = await Promise.all([
    listContacts(ctx, { query, archived }), canManage ? listCompanies(ctx) : [], canManage ? listCrmOwners(ctx) : [],
  ]);
  const filtered = Boolean(query || archived);
  const add = canManage ? <ContactDialog slug={ctx.organization.slug} owners={owners} companies={companies.map((c) => ({ id: c.id, name: c.name }))} defaultOwnerId={ctx.memberId} trigger={<Button><Plus />New contact</Button>} /> : undefined;

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="Contacts" description="The people you sell to and work with." actions={add} />
      <ListFilters placeholder="Search by name, email or company" select={{ key: "show", label: "Show", options: [{ value: "", label: "Active" }, { value: "archived", label: "Archived" }] }} />
      <Card className="min-w-0 overflow-hidden">
        {contacts.length === 0 ? (
          <EmptyState icon={Contact} title={filtered ? "No contacts match" : "No contacts yet"}
            description={filtered ? "Try a different search." : "Add contacts here, or convert a lead to create one."} action={!filtered ? add : undefined} />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-surface-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Company</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Phone</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Owner</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Open deals</th>
                  <th scope="col" className="w-8"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((c, i) => (
                  <tr key={c.id} className="motion-safe:animate-rise group relative hover:bg-surface-muted/50" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <td className="px-4 py-3">
                      <Link href={`${base}/contacts/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                        <Avatar name={c.fullName} />
                        <span className="grid min-w-0">
                          <span className="truncate font-medium">{c.fullName}</span>
                          <span className="truncate text-xs text-muted-foreground">{[c.jobTitle, c.email].filter(Boolean).join(" · ") || "—"}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-secondary-foreground">{c.company?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-secondary-foreground">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-secondary-foreground">{c.owner?.name ?? "—"}</td>
                    <td className="px-4 py-3">{c.openDeals > 0 ? <Badge tone="primary">{c.openDeals}</Badge> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="pr-3 text-muted-foreground"><ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ContactsPage(props: PageProps<"/[organizationSlug]/crm/contacts">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-10" /><Skeleton className="h-96" /></div>}><Contacts {...props} /></Suspense>;
}
