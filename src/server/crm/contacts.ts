import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, can, type OrgContext } from "@/server/tenancy/context";
import { isUniqueViolation } from "@/server/database/errors";
import { ConflictError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { companySchema, contactSchema } from "@/lib/validation/crm";
import { assertOwnCompany, assertOwnMember, notFound } from "./shared";

export interface CompanyRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  phone: string | null;
  city: string | null;
  owner: { id: string; name: string } | null;
  contactCount: number;
  openDeals: number;
  archived: boolean;
}

export interface ContactRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  company: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  openDeals: number;
  archived: boolean;
}

type Owner = { owner_id: string | null; owner_name: string | null };
const owner = (r: Owner) => (r.owner_id ? { id: r.owner_id, name: r.owner_name ?? "Former member" } : null);

/* ─────────────────────────────── companies ─────────────────────────────── */

export async function listCompanies(ctx: OrgContext, opts: { query?: string; archived?: boolean } = {}): Promise<CompanyRow[]> {
  assertPermission(ctx, "crm.contact.read");
  const q = opts.query?.trim() ? `%${opts.query.trim().toLowerCase()}%` : null;
  const sql = getDb();
  const rows = await sql<(Owner & { id: string; name: string; website: string | null; industry: string | null; phone: string | null; city: string | null; contacts: number; open_deals: number; archived: boolean })[]>`
    select c.id, c.name, c.website, c.industry, c.phone, c.city, c.archived_at is not null as archived,
      m.id as owner_id, p.name as owner_name,
      (select count(*)::int from crm_contact k where k.company_id = c.id and k.organization_id = c.organization_id and k.archived_at is null) as contacts,
      (select count(*)::int from crm_deal d join crm_stage s on s.id = d.stage_id
         where d.company_id = c.id and d.organization_id = c.organization_id and d.archived_at is null and s.kind = 'open') as open_deals
    from crm_company c
    left join organization_member m on m.id = c.owner_member_id and m.organization_id = c.organization_id
    left join profile p on p.id = m.user_id
    where c.organization_id = ${ctx.organizationId}
      and ${opts.archived ? sql`c.archived_at is not null` : sql`c.archived_at is null`}
      ${q ? sql`and (lower(c.name) like ${q} or lower(coalesce(c.industry, '')) like ${q} or lower(coalesce(c.city, '')) like ${q})` : sql``}
    order by lower(c.name) limit 500`;
  return rows.map((r) => ({ id: r.id, name: r.name, website: r.website, industry: r.industry, phone: r.phone, city: r.city, owner: owner(r), contactCount: r.contacts, openDeals: r.open_deals, archived: r.archived }));
}

export async function getCompany(ctx: OrgContext, id: string): Promise<CompanyRow> {
  assertPermission(ctx, "crm.contact.read");
  if (!isUuid(id)) notFound("Company");
  const rows = await listCompaniesByIds(ctx, [id]);
  if (!rows[0]) notFound("Company");
  return rows[0];
}

async function listCompaniesByIds(ctx: OrgContext, ids: string[]): Promise<CompanyRow[]> {
  const sql = getDb();
  const rows = await sql<(Owner & { id: string; name: string; website: string | null; industry: string | null; phone: string | null; city: string | null; contacts: number; open_deals: number; archived: boolean })[]>`
    select c.id, c.name, c.website, c.industry, c.phone, c.city, c.archived_at is not null as archived,
      m.id as owner_id, p.name as owner_name,
      (select count(*)::int from crm_contact k where k.company_id = c.id and k.organization_id = c.organization_id and k.archived_at is null) as contacts,
      (select count(*)::int from crm_deal d join crm_stage s on s.id = d.stage_id
         where d.company_id = c.id and d.organization_id = c.organization_id and d.archived_at is null and s.kind = 'open') as open_deals
    from crm_company c
    left join organization_member m on m.id = c.owner_member_id and m.organization_id = c.organization_id
    left join profile p on p.id = m.user_id
    where c.organization_id = ${ctx.organizationId} and c.id in ${sql(ids)}`;
  return rows.map((r) => ({ id: r.id, name: r.name, website: r.website, industry: r.industry, phone: r.phone, city: r.city, owner: owner(r), contactCount: r.contacts, openDeals: r.open_deals, archived: r.archived }));
}

export async function createCompany(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "crm.contact.manage");
  const d = parseInput(companySchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertOwnMember(tx, ctx.organizationId, d.ownerMemberId);
    const [row] = await tx<{ id: string }[]>`
      insert into crm_company (organization_id, name, website, industry, phone, city, owner_member_id, created_by_id)
      values (${ctx.organizationId}, ${d.name}, ${d.website}, ${d.industry}, ${d.phone}, ${d.city}, ${d.ownerMemberId}, ${ctx.userId})
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.company_created", targetType: "crm_company", targetId: row.id, metadata: { name: d.name } });
    return row;
  }).catch(companyConflict);
}

export async function updateCompany(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "crm.contact.manage");
  if (!isUuid(id)) notFound("Company");
  const d = parseInput(companySchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertOwnMember(tx, ctx.organizationId, d.ownerMemberId);
    const res = await tx`
      update crm_company set name = ${d.name}, website = ${d.website}, industry = ${d.industry}, phone = ${d.phone}, city = ${d.city},
        owner_member_id = ${d.ownerMemberId}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    if (res.count === 0) notFound("Company");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.company_updated", targetType: "crm_company", targetId: id, metadata: { name: d.name } });
  }).catch(companyConflict);
}

export async function setCompanyArchived(ctx: OrgContext, id: string, archived: boolean): Promise<void> {
  assertPermission(ctx, "crm.contact.manage");
  if (!isUuid(id)) notFound("Company");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ name: string }[]>`
      update crm_company set archived_at = ${archived ? tx`now()` : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId} returning name`;
    if (!row) notFound("Company");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: archived ? "crm.company_archived" : "crm.company_restored", targetType: "crm_company", targetId: id, metadata: { name: row.name } });
  });
}

function companyConflict(e: unknown): never {
  if (isUniqueViolation(e, "crm_company_org_name")) throw new ConflictError("A company with this name already exists.");
  throw e;
}

/* ─────────────────────────────── contacts ─────────────────────────────── */

type ContactDbRow = Owner & { id: string; full_name: string; email: string | null; phone: string | null; job_title: string | null; company_id: string | null; company_name: string | null; open_deals: number; archived: boolean };
const toContact = (r: ContactDbRow): ContactRow => ({
  id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, jobTitle: r.job_title,
  company: r.company_id ? { id: r.company_id, name: r.company_name! } : null, owner: owner(r), openDeals: r.open_deals, archived: r.archived,
});

export async function listContacts(ctx: OrgContext, opts: { query?: string; companyId?: string; archived?: boolean } = {}): Promise<ContactRow[]> {
  assertPermission(ctx, "crm.contact.read");
  const q = opts.query?.trim() ? `%${opts.query.trim().toLowerCase()}%` : null;
  const companyId = opts.companyId && isUuid(opts.companyId) ? opts.companyId : null;
  if (opts.companyId && !companyId) return [];
  const sql = getDb();
  const rows = await sql<ContactDbRow[]>`
    select k.id, k.full_name, k.email, k.phone, k.job_title, k.archived_at is not null as archived,
      c.id as company_id, c.name as company_name, m.id as owner_id, p.name as owner_name,
      (select count(*)::int from crm_deal d join crm_stage s on s.id = d.stage_id
         where d.contact_id = k.id and d.organization_id = k.organization_id and d.archived_at is null and s.kind = 'open') as open_deals
    from crm_contact k
    left join crm_company c on c.id = k.company_id and c.organization_id = k.organization_id
    left join organization_member m on m.id = k.owner_member_id and m.organization_id = k.organization_id
    left join profile p on p.id = m.user_id
    where k.organization_id = ${ctx.organizationId}
      and ${opts.archived ? sql`k.archived_at is not null` : sql`k.archived_at is null`}
      ${companyId ? sql`and k.company_id = ${companyId}` : sql``}
      ${q ? sql`and (lower(k.full_name) like ${q} or lower(coalesce(k.email, '')) like ${q} or lower(coalesce(c.name, '')) like ${q})` : sql``}
    order by lower(k.full_name) limit 500`;
  return rows.map(toContact);
}

export async function getContact(ctx: OrgContext, id: string): Promise<ContactRow> {
  assertPermission(ctx, "crm.contact.read");
  if (!isUuid(id)) notFound("Contact");
  const sql = getDb();
  const [r] = await sql<ContactDbRow[]>`
    select k.id, k.full_name, k.email, k.phone, k.job_title, k.archived_at is not null as archived,
      c.id as company_id, c.name as company_name, m.id as owner_id, p.name as owner_name,
      (select count(*)::int from crm_deal d join crm_stage s on s.id = d.stage_id
         where d.contact_id = k.id and d.organization_id = k.organization_id and d.archived_at is null and s.kind = 'open') as open_deals
    from crm_contact k
    left join crm_company c on c.id = k.company_id and c.organization_id = k.organization_id
    left join organization_member m on m.id = k.owner_member_id and m.organization_id = k.organization_id
    left join profile p on p.id = m.user_id
    where k.organization_id = ${ctx.organizationId} and k.id = ${id}`;
  if (!r) notFound("Contact");
  return toContact(r);
}

export async function createContact(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "crm.contact.manage");
  const d = parseInput(contactSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertOwnCompany(tx, ctx.organizationId, d.companyId);
    await assertOwnMember(tx, ctx.organizationId, d.ownerMemberId);
    const [row] = await tx<{ id: string }[]>`
      insert into crm_contact (organization_id, company_id, full_name, email, phone, job_title, owner_member_id, created_by_id)
      values (${ctx.organizationId}, ${d.companyId}, ${d.fullName}, ${d.email}, ${d.phone}, ${d.jobTitle}, ${d.ownerMemberId}, ${ctx.userId})
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.contact_created", targetType: "crm_contact", targetId: row.id, metadata: { name: d.fullName } });
    return row;
  }).catch(contactConflict);
}

export async function updateContact(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "crm.contact.manage");
  if (!isUuid(id)) notFound("Contact");
  const d = parseInput(contactSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertOwnCompany(tx, ctx.organizationId, d.companyId);
    await assertOwnMember(tx, ctx.organizationId, d.ownerMemberId);
    const res = await tx`
      update crm_contact set full_name = ${d.fullName}, email = ${d.email}, phone = ${d.phone}, job_title = ${d.jobTitle},
        company_id = ${d.companyId}, owner_member_id = ${d.ownerMemberId}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    if (res.count === 0) notFound("Contact");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.contact_updated", targetType: "crm_contact", targetId: id, metadata: { name: d.fullName } });
  }).catch(contactConflict);
}

export async function setContactArchived(ctx: OrgContext, id: string, archived: boolean): Promise<void> {
  assertPermission(ctx, "crm.contact.manage");
  if (!isUuid(id)) notFound("Contact");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ full_name: string }[]>`
      update crm_contact set archived_at = ${archived ? tx`now()` : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId} returning full_name`;
    if (!row) notFound("Contact");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: archived ? "crm.contact_archived" : "crm.contact_restored", targetType: "crm_contact", targetId: id, metadata: { name: row.full_name } });
  });
}

function contactConflict(e: unknown): never {
  if (isUniqueViolation(e, "crm_contact_org_email")) throw new ConflictError("A contact with this email already exists.");
  throw e;
}

/** Active members who can own CRM records (names only). */
export async function listCrmOwners(ctx: OrgContext): Promise<{ id: string; name: string }[]> {
  if (!(can(ctx, "crm.lead.read") || can(ctx, "crm.contact.read") || can(ctx, "crm.deal.read"))) assertPermission(ctx, "crm.deal.read");
  return getDb()<{ id: string; name: string }[]>`
    select m.id, coalesce(p.name, p.email) as name
    from organization_member m join profile p on p.id = m.user_id
    where m.organization_id = ${ctx.organizationId} and m.status = 'active'
    order by lower(coalesce(p.name, p.email))`;
}
