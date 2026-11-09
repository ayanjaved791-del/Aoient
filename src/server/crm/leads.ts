import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { ConflictError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { convertLeadSchema, leadSchema, type LEAD_SOURCES } from "@/lib/validation/crm";
import { assertOwnMember, notFound, stageFor } from "./shared";

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = "new" | "contacted" | "qualified" | "disqualified" | "converted";

export interface LeadRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: LeadSource;
  status: LeadStatus;
  estimatedValue: number | null;
  owner: { id: string; name: string } | null;
  convertedContactId: string | null;
  convertedDealId: string | null;
  convertedAt: Date | null;
  archived: boolean;
  createdAt: Date;
}

type LeadDbRow = {
  id: string; full_name: string; email: string | null; phone: string | null; company_name: string | null; source: LeadSource; status: LeadStatus;
  estimated_value: string | null; owner_id: string | null; owner_name: string | null; converted_contact_id: string | null; converted_deal_id: string | null;
  converted_at: Date | null; archived: boolean; created_at: Date;
};
const toLead = (r: LeadDbRow): LeadRow => ({
  id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, companyName: r.company_name, source: r.source, status: r.status,
  estimatedValue: r.estimated_value === null ? null : Number(r.estimated_value),
  owner: r.owner_id ? { id: r.owner_id, name: r.owner_name ?? "Former member" } : null,
  convertedContactId: r.converted_contact_id, convertedDealId: r.converted_deal_id, convertedAt: r.converted_at, archived: r.archived, createdAt: r.created_at,
});

export async function listLeads(ctx: OrgContext, opts: { status?: LeadStatus | "open" | "all"; query?: string; archived?: boolean } = {}): Promise<LeadRow[]> {
  assertPermission(ctx, "crm.lead.read");
  const sql = getDb();
  const status = opts.status ?? "open";
  const q = opts.query?.trim() ? `%${opts.query.trim().toLowerCase()}%` : null;
  const rows = await sql<LeadDbRow[]>`
    select l.id, l.full_name, l.email, l.phone, l.company_name, l.source, l.status, l.estimated_value,
      m.id as owner_id, p.name as owner_name, l.converted_contact_id, l.converted_deal_id, l.converted_at, l.archived_at is not null as archived, l.created_at
    from crm_lead l
    left join organization_member m on m.id = l.owner_member_id and m.organization_id = l.organization_id
    left join profile p on p.id = m.user_id
    where l.organization_id = ${ctx.organizationId}
      and ${opts.archived ? sql`l.archived_at is not null` : sql`l.archived_at is null`}
      ${status === "open" ? sql`and l.status in ('new', 'contacted', 'qualified')` : status === "all" ? sql`` : sql`and l.status = ${status}`}
      ${q ? sql`and (lower(l.full_name) like ${q} or lower(coalesce(l.email, '')) like ${q} or lower(coalesce(l.company_name, '')) like ${q})` : sql``}
    order by l.created_at desc limit 500`;
  return rows.map(toLead);
}

export async function getLead(ctx: OrgContext, id: string): Promise<LeadRow> {
  assertPermission(ctx, "crm.lead.read");
  if (!isUuid(id)) notFound("Lead");
  const [r] = await getDb()<LeadDbRow[]>`
    select l.id, l.full_name, l.email, l.phone, l.company_name, l.source, l.status, l.estimated_value,
      m.id as owner_id, p.name as owner_name, l.converted_contact_id, l.converted_deal_id, l.converted_at, l.archived_at is not null as archived, l.created_at
    from crm_lead l
    left join organization_member m on m.id = l.owner_member_id and m.organization_id = l.organization_id
    left join profile p on p.id = m.user_id
    where l.organization_id = ${ctx.organizationId} and l.id = ${id}`;
  if (!r) notFound("Lead");
  return toLead(r);
}

export async function createLead(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "crm.lead.create");
  const d = parseInput(leadSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertOwnMember(tx, ctx.organizationId, d.ownerMemberId);
    const [row] = await tx<{ id: string }[]>`
      insert into crm_lead (organization_id, full_name, email, phone, company_name, source, status, estimated_value, owner_member_id, created_by_id)
      values (${ctx.organizationId}, ${d.fullName}, ${d.email}, ${d.phone}, ${d.companyName}, ${d.source}, ${d.status}, ${d.estimatedValue},
        ${d.ownerMemberId ?? ctx.memberId}, ${ctx.userId})
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.lead_created", targetType: "crm_lead", targetId: row.id, metadata: { name: d.fullName, source: d.source } });
    return row;
  });
}

export async function updateLead(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "crm.lead.update");
  if (!isUuid(id)) notFound("Lead");
  const d = parseInput(leadSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await assertOwnMember(tx, ctx.organizationId, d.ownerMemberId);
    const [cur] = await tx<{ status: LeadStatus }[]>`select status from crm_lead where id = ${id} and organization_id = ${ctx.organizationId} for update`;
    if (!cur) notFound("Lead");
    if (cur.status === "converted") throw new ConflictError("This lead was already converted. Edit the contact or deal instead.");
    await tx`
      update crm_lead set full_name = ${d.fullName}, email = ${d.email}, phone = ${d.phone}, company_name = ${d.companyName}, source = ${d.source},
        status = ${d.status}, estimated_value = ${d.estimatedValue}, owner_member_id = ${d.ownerMemberId}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.lead_updated", targetType: "crm_lead", targetId: id, metadata: { name: d.fullName, status: d.status } });
  });
}

export async function setLeadArchived(ctx: OrgContext, id: string, archived: boolean): Promise<void> {
  assertPermission(ctx, "crm.lead.archive");
  if (!isUuid(id)) notFound("Lead");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ full_name: string }[]>`
      update crm_lead set archived_at = ${archived ? tx`now()` : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId} returning full_name`;
    if (!row) notFound("Lead");
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: archived ? "crm.lead_archived" : "crm.lead_updated", targetType: "crm_lead", targetId: id, metadata: { name: row.full_name, ...(archived ? {} : { restored: true }) } });
  });
}

/**
 * Turns a lead into a contact (and a company, if it named one), and optionally
 * a deal in the first open stage. Existing records are reused: a company with
 * the same name, a contact with the same email.
 */
export async function convertLead(ctx: OrgContext, id: string, input: unknown): Promise<{ contactId: string; companyId: string | null; dealId: string | null }> {
  assertPermission(ctx, "crm.lead.update");
  assertPermission(ctx, "crm.contact.manage");
  if (!isUuid(id)) notFound("Lead");
  const d = parseInput(convertLeadSchema, input);
  if (d.createDeal) assertPermission(ctx, "crm.deal.create");
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [lead] = await tx<{ full_name: string; email: string | null; phone: string | null; company_name: string | null; estimated_value: string | null; owner_member_id: string | null; status: LeadStatus; archived: boolean }[]>`
      select full_name, email, phone, company_name, estimated_value, owner_member_id, status, archived_at is not null as archived
      from crm_lead where id = ${id} and organization_id = ${ctx.organizationId} for update`;
    if (!lead) notFound("Lead");
    if (lead.status === "converted") throw new ConflictError("This lead was already converted.");
    if (lead.archived) throw new ConflictError("Restore this lead before converting it.");

    let companyId: string | null = null;
    if (lead.company_name) {
      const [existing] = await tx<{ id: string }[]>`select id from crm_company where organization_id = ${ctx.organizationId} and lower(name) = lower(${lead.company_name})`;
      companyId = existing?.id ?? (await tx<{ id: string }[]>`
        insert into crm_company (organization_id, name, owner_member_id, created_by_id)
        values (${ctx.organizationId}, ${lead.company_name}, ${lead.owner_member_id}, ${ctx.userId}) returning id`)[0].id;
    }
    const [sameEmail] = lead.email
      ? await tx<{ id: string }[]>`select id from crm_contact where organization_id = ${ctx.organizationId} and lower(email) = lower(${lead.email})`
      : [];
    const contactId = sameEmail?.id ?? (await tx<{ id: string }[]>`
      insert into crm_contact (organization_id, company_id, full_name, email, phone, owner_member_id, created_by_id)
      values (${ctx.organizationId}, ${companyId}, ${lead.full_name}, ${lead.email}, ${lead.phone}, ${lead.owner_member_id}, ${ctx.userId}) returning id`)[0].id;

    let dealId: string | null = null;
    if (d.createDeal) {
      const stage = await stageFor(tx, ctx.organizationId, null);
      const title = d.dealTitle ?? (lead.company_name ? `${lead.company_name} deal` : `${lead.full_name} deal`);
      const amount = d.amount ?? (lead.estimated_value === null ? 0 : Number(lead.estimated_value));
      dealId = (await tx<{ id: string }[]>`
        insert into crm_deal (organization_id, title, stage_id, company_id, contact_id, amount, currency, owner_member_id, created_by_id)
        values (${ctx.organizationId}, ${title}, ${stage.id}, ${companyId}, ${contactId}, ${amount}, ${ctx.organization.currency},
          ${lead.owner_member_id ?? ctx.memberId}, ${ctx.userId}) returning id`)[0].id;
    }
    await tx`
      update crm_lead set status = 'converted', converted_contact_id = ${contactId}, converted_deal_id = ${dealId}, converted_at = now(), updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.lead_converted", targetType: "crm_lead", targetId: id, metadata: { name: lead.full_name, deal: Boolean(dealId) } });
    return { contactId, companyId, dealId };
  });
}
