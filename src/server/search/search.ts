import "server-only";
import { getDb } from "@/server/database/client";
import { can, type OrgContext } from "@/server/tenancy/context";
import { visibleProject } from "@/server/projects/shared";
import { docNumber } from "@/server/finance/shared";

/**
 * Workspace search (Ctrl+K). Each group runs only when the person's role can
 * open that kind of record, scoped to the verified organization, with the
 * same visibility rules as the pages (projects and tasks: only ones they see).
 */
export interface SearchHit { id: string; group: string; title: string; subtitle: string | null; href: string }

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function searchWorkspace(ctx: OrgContext, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const sql = getDb();
  const org = ctx.organizationId;
  const base = `/${ctx.organization.slug}`;
  const L = like(q);
  const n = 5;
  const jobs: Promise<SearchHit[]>[] = [];

  if (can(ctx, "people.employee.read")) jobs.push(sql<{ id: string; full_name: string; job_title: string | null }[]>`
    select id, full_name, job_title from employee where organization_id = ${org} and status = 'active'
      and (full_name ilike ${L} or work_email ilike ${L} or job_title ilike ${L}) order by lower(full_name) limit ${n}`
    .then((r) => r.map((x) => ({ id: x.id, group: "People", title: x.full_name, subtitle: x.job_title, href: `${base}/people/${x.id}` }))));

  if (can(ctx, "projects.project.read")) {
    jobs.push(sql<{ id: string; name: string; status: string }[]>`
      select p.id, p.name, p.status from project p where p.organization_id = ${org} and p.archived_at is null and ${visibleProject(sql, ctx)}
        and p.name ilike ${L} order by lower(p.name) limit ${n}`
      .then((r) => r.map((x) => ({ id: x.id, group: "Projects", title: x.name, subtitle: x.status.replace("_", " "), href: `${base}/projects/${x.id}` }))));
    if (can(ctx, "projects.task.read")) jobs.push(sql<{ id: string; title: string; project_id: string; project: string }[]>`
      select t.id, t.title, p.id as project_id, p.name as project from project_task t join project p on p.id = t.project_id and p.organization_id = t.organization_id
      where t.organization_id = ${org} and p.archived_at is null and ${visibleProject(sql, ctx)} and t.title ilike ${L}
      order by (t.status = 'done'), t.updated_at desc limit ${n}`
      .then((r) => r.map((x) => ({ id: x.id, group: "Tasks", title: x.title, subtitle: x.project, href: `${base}/projects/${x.project_id}/tasks/${x.id}` }))));
  }

  if (can(ctx, "crm.deal.read")) jobs.push(sql<{ id: string; title: string; company: string | null }[]>`
    select d.id, d.title, c.name as company from crm_deal d left join crm_company c on c.id = d.company_id and c.organization_id = d.organization_id
    where d.organization_id = ${org} and d.archived_at is null and (d.title ilike ${L} or c.name ilike ${L}) order by d.updated_at desc limit ${n}`
    .then((r) => r.map((x) => ({ id: x.id, group: "Deals", title: x.title, subtitle: x.company, href: `${base}/crm/deals/${x.id}` }))));
  if (can(ctx, "crm.lead.read")) jobs.push(sql<{ id: string; full_name: string; company_name: string | null }[]>`
    select id, full_name, company_name from crm_lead where organization_id = ${org} and archived_at is null
      and (full_name ilike ${L} or email ilike ${L} or company_name ilike ${L}) order by updated_at desc limit ${n}`
    .then((r) => r.map((x) => ({ id: x.id, group: "Leads", title: x.full_name, subtitle: x.company_name, href: `${base}/crm/leads?q=${encodeURIComponent(x.full_name)}` }))));
  if (can(ctx, "crm.contact.read")) {
    jobs.push(sql<{ id: string; name: string; industry: string | null }[]>`
      select id, name, industry from crm_company where organization_id = ${org} and archived_at is null and name ilike ${L} order by lower(name) limit ${n}`
      .then((r) => r.map((x) => ({ id: x.id, group: "Companies", title: x.name, subtitle: x.industry, href: `${base}/crm/companies/${x.id}` }))));
    jobs.push(sql<{ id: string; full_name: string; email: string | null }[]>`
      select id, full_name, email from crm_contact where organization_id = ${org} and archived_at is null and (full_name ilike ${L} or email ilike ${L}) order by lower(full_name) limit ${n}`
      .then((r) => r.map((x) => ({ id: x.id, group: "Contacts", title: x.full_name, subtitle: x.email, href: `${base}/crm/contacts/${x.id}` }))));
  }

  if (can(ctx, "finance.invoice.read")) {
    const num = q.match(/^(inv|est)?-?\s*0*(\d{1,6})$/i);
    jobs.push(sql<{ id: string; kind: "invoice" | "estimate"; number: number; bill_to_name: string; status: string }[]>`
      select id, kind, number, bill_to_name, status from finance_document where organization_id = ${org}
        and (bill_to_name ilike ${L} ${num ? sql`or number = ${Number(num[2])}` : sql``})
        ${num?.[1] ? sql`and kind = ${num[1].toLowerCase() === "inv" ? "invoice" : "estimate"}` : sql``}
      order by issue_date desc limit ${n}`
      .then((r) => r.map((x) => ({ id: x.id, group: x.kind === "invoice" ? "Invoices" : "Estimates", title: docNumber(x.kind, x.number), subtitle: `${x.bill_to_name} · ${x.status}`, href: `${base}/finance/${x.kind === "invoice" ? "invoices" : "estimates"}/${x.id}` }))));
  }
  if (can(ctx, "finance.vendor.manage") || can(ctx, "finance.expense.read") || can(ctx, "finance.expense.manage")) jobs.push(sql<{ id: string; name: string }[]>`
    select id, name from finance_vendor where organization_id = ${org} and archived_at is null and name ilike ${L} order by lower(name) limit ${n}`
    .then((r) => r.map((x) => ({ id: x.id, group: "Vendors", title: x.name, subtitle: null, href: `${base}/finance/vendors?q=${encodeURIComponent(x.name)}` }))));
  if (can(ctx, "inventory.read")) jobs.push(sql<{ id: string; name: string; sku: string }[]>`
    select id, name, sku from inventory_product where organization_id = ${org} and archived_at is null and (name ilike ${L} or sku ilike ${L}) order by lower(name) limit ${n}`
    .then((r) => r.map((x) => ({ id: x.id, group: "Products", title: x.name, subtitle: x.sku, href: `${base}/inventory/products/${x.id}` }))));

  return (await Promise.all(jobs)).flat();
}
