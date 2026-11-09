import "server-only";
import { getDb, transaction, type Db } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { isUniqueViolation } from "@/server/database/errors";
import { ConflictError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { dealSchema, moveDealSchema, stageOrderSchema, stageSchema } from "@/lib/validation/crm";
import { assertOwnCompany, assertOwnContact, assertOwnMember, ensureStages, notFound, stageFor } from "./shared";

export type StageKind = "open" | "won" | "lost";
export interface Stage { id: string; name: string; position: number; kind: StageKind; probability: number; dealCount: number }

export interface DealRow {
  id: string;
  title: string;
  amount: number;
  currency: string;
  expectedCloseDate: string | null;
  stage: { id: string; name: string; kind: StageKind; probability: number };
  company: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  closedAt: Date | null;
  lostReason: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/* ─────────────────────────────── stages ─────────────────────────────── */

export async function listStages(ctx: OrgContext): Promise<Stage[]> {
  assertPermission(ctx, "crm.deal.read");
  const sql = getDb();
  await ensureStages(sql, ctx.organizationId);
  return sql<Stage[]>`
    select s.id, s.name, s.position, s.kind, s.probability,
      (select count(*)::int from crm_deal d where d.stage_id = s.id and d.organization_id = s.organization_id and d.archived_at is null) as "dealCount"
    from crm_stage s where s.organization_id = ${ctx.organizationId}
    order by s.position, s.created_at`;
}

export async function createStage(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "crm.pipeline.manage");
  const d = parseInput(stageSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    await ensureStages(tx, ctx.organizationId);
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from crm_stage where organization_id = ${ctx.organizationId}`;
    if (n >= 20) throw new ValidationError("A pipeline can have up to 20 stages.");
    // New open stages go before the closing (won/lost) stages.
    const [{ pos }] = await tx<{ pos: number }[]>`
      select coalesce(${d.kind === "open" ? tx`(select min(position) from crm_stage where organization_id = ${ctx.organizationId} and kind <> 'open')` : tx`null`},
        (select max(position) + 1 from crm_stage where organization_id = ${ctx.organizationId}), 0) as pos`;
    await tx`update crm_stage set position = position + 1 where organization_id = ${ctx.organizationId} and position >= ${pos}`;
    const [row] = await tx<{ id: string }[]>`
      insert into crm_stage (organization_id, name, position, kind, probability)
      values (${ctx.organizationId}, ${d.name}, ${pos}, ${d.kind}, ${d.probability ?? (d.kind === "won" ? 100 : d.kind === "lost" ? 0 : 50)})
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.stage_created", targetType: "crm_stage", targetId: row.id, metadata: { name: d.name } });
    return row;
  }).catch(stageConflict);
}

export async function updateStage(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "crm.pipeline.manage");
  if (!isUuid(id)) notFound("Stage");
  const d = parseInput(stageSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [cur] = await tx<{ kind: StageKind }[]>`select kind from crm_stage where id = ${id} and organization_id = ${ctx.organizationId} for update`;
    if (!cur) notFound("Stage");
    if (cur.kind === "open" && d.kind !== "open") await assertAnotherOpenStage(tx, ctx.organizationId, id);
    await tx`update crm_stage set name = ${d.name}, kind = ${d.kind}, probability = ${d.probability ?? (d.kind === "won" ? 100 : d.kind === "lost" ? 0 : 50)}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    // Deals follow their stage: they're closed when it's a won or lost stage, open otherwise.
    await tx`update crm_deal set closed_at = ${d.kind === "open" ? null : tx`coalesce(closed_at, now())`}, updated_at = now()
      where stage_id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.stage_updated", targetType: "crm_stage", targetId: id, metadata: { name: d.name, kind: d.kind } });
  }).catch(stageConflict);
}

/** A stage can only be removed when no deals are in it, and the pipeline keeps at least one open stage. */
export async function deleteStage(ctx: OrgContext, id: string): Promise<void> {
  assertPermission(ctx, "crm.pipeline.manage");
  if (!isUuid(id)) notFound("Stage");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [cur] = await tx<{ kind: StageKind; name: string }[]>`select kind, name from crm_stage where id = ${id} and organization_id = ${ctx.organizationId} for update`;
    if (!cur) notFound("Stage");
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from crm_deal where stage_id = ${id} and organization_id = ${ctx.organizationId}`;
    if (n > 0) throw new ConflictError(`Move the ${n} ${n === 1 ? "deal" : "deals"} out of ${cur.name} first.`);
    if (cur.kind === "open") await assertAnotherOpenStage(tx, ctx.organizationId, id);
    await tx`delete from crm_stage where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.stage_deleted", targetType: "crm_stage", targetId: id, metadata: { name: cur.name } });
  });
}

export async function reorderStages(ctx: OrgContext, input: unknown): Promise<void> {
  assertPermission(ctx, "crm.pipeline.manage");
  const { ids } = parseInput(stageOrderSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const own = await tx<{ id: string }[]>`select id from crm_stage where organization_id = ${ctx.organizationId}`;
    const ownIds = new Set(own.map((r) => r.id));
    if (ids.length !== ownIds.size || new Set(ids).size !== ids.length || !ids.every((i) => ownIds.has(i))) {
      throw new ValidationError("The stage list changed. Reload and try again.");
    }
    for (const [i, sid] of ids.entries()) await tx`update crm_stage set position = ${i}, updated_at = now() where id = ${sid} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.stages_reordered", targetType: "crm_stage", metadata: { count: ids.length } });
  });
}

async function assertAnotherOpenStage(tx: Db, organizationId: string, exceptId: string) {
  const [other] = await tx`select 1 from crm_stage where organization_id = ${organizationId} and kind = 'open' and id <> ${exceptId} limit 1`;
  if (!other) throw new ValidationError("Keep at least one open stage in the pipeline.");
}

function stageConflict(e: unknown): never {
  if (isUniqueViolation(e, "crm_stage_org_name")) throw new ConflictError("A stage with this name already exists.");
  throw e;
}

/* ─────────────────────────────── deals ─────────────────────────────── */

type DealDbRow = {
  id: string; title: string; amount: string; currency: string; expected_close_date: string | null;
  stage_id: string; stage_name: string; stage_kind: StageKind; probability: number;
  company_id: string | null; company_name: string | null; contact_id: string | null; contact_name: string | null;
  owner_id: string | null; owner_name: string | null; closed_at: Date | null; lost_reason: string | null; archived: boolean; created_at: Date; updated_at: Date;
};
const toDeal = (r: DealDbRow): DealRow => ({
  id: r.id, title: r.title, amount: Number(r.amount), currency: r.currency, expectedCloseDate: r.expected_close_date,
  stage: { id: r.stage_id, name: r.stage_name, kind: r.stage_kind, probability: r.probability },
  company: r.company_id ? { id: r.company_id, name: r.company_name! } : null,
  contact: r.contact_id ? { id: r.contact_id, name: r.contact_name! } : null,
  owner: r.owner_id ? { id: r.owner_id, name: r.owner_name ?? "Former member" } : null,
  closedAt: r.closed_at, lostReason: r.lost_reason, archived: r.archived, createdAt: r.created_at, updatedAt: r.updated_at,
});

function dealQuery(sql: ReturnType<typeof getDb>, organizationId: string, where: ReturnType<ReturnType<typeof getDb>>) {
  return sql<DealDbRow[]>`
    select d.id, d.title, d.amount, d.currency, to_char(d.expected_close_date, 'YYYY-MM-DD') as expected_close_date,
      s.id as stage_id, s.name as stage_name, s.kind as stage_kind, s.probability,
      c.id as company_id, c.name as company_name, k.id as contact_id, k.full_name as contact_name,
      m.id as owner_id, p.name as owner_name, d.closed_at, d.lost_reason, d.archived_at is not null as archived, d.created_at, d.updated_at
    from crm_deal d
    join crm_stage s on s.id = d.stage_id and s.organization_id = d.organization_id
    left join crm_company c on c.id = d.company_id and c.organization_id = d.organization_id
    left join crm_contact k on k.id = d.contact_id and k.organization_id = d.organization_id
    left join organization_member m on m.id = d.owner_member_id and m.organization_id = d.organization_id
    left join profile p on p.id = m.user_id
    where d.organization_id = ${organizationId} and ${where}
    order by s.position, d.updated_at desc
    limit 1000`;
}

/** Every deal that isn't archived, for the pipeline board (optionally only one owner's or one company's / contact's). */
export async function listDeals(ctx: OrgContext, opts: { ownerMemberId?: string; companyId?: string; contactId?: string; query?: string; archived?: boolean } = {}): Promise<DealRow[]> {
  assertPermission(ctx, "crm.deal.read");
  const sql = getDb();
  const ids = [opts.ownerMemberId, opts.companyId, opts.contactId].filter(Boolean) as string[];
  if (ids.some((i) => !isUuid(i))) return [];
  const q = opts.query?.trim() ? `%${opts.query.trim().toLowerCase()}%` : null;
  const rows = await dealQuery(sql, ctx.organizationId, sql`
    ${opts.archived ? sql`d.archived_at is not null` : sql`d.archived_at is null`}
    ${opts.ownerMemberId ? sql`and d.owner_member_id = ${opts.ownerMemberId}` : sql``}
    ${opts.companyId ? sql`and d.company_id = ${opts.companyId}` : sql``}
    ${opts.contactId ? sql`and d.contact_id = ${opts.contactId}` : sql``}
    ${q ? sql`and (lower(d.title) like ${q} or lower(coalesce(c.name, '')) like ${q} or lower(coalesce(k.full_name, '')) like ${q})` : sql``}`);
  return rows.map(toDeal);
}

export async function getDeal(ctx: OrgContext, id: string): Promise<DealRow> {
  assertPermission(ctx, "crm.deal.read");
  if (!isUuid(id)) notFound("Deal");
  const sql = getDb();
  const [row] = await dealQuery(sql, ctx.organizationId, sql`d.id = ${id}`);
  if (!row) notFound("Deal");
  return toDeal(row);
}

export async function createDeal(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "crm.deal.create");
  const d = parseInput(dealSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const stage = await stageFor(tx, ctx.organizationId, d.stageId);
    await assertOwnCompany(tx, ctx.organizationId, d.companyId);
    await assertOwnContact(tx, ctx.organizationId, d.contactId);
    await assertOwnMember(tx, ctx.organizationId, d.ownerMemberId);
    const [row] = await tx<{ id: string }[]>`
      insert into crm_deal (organization_id, title, stage_id, company_id, contact_id, amount, currency, expected_close_date, owner_member_id, closed_at, created_by_id)
      values (${ctx.organizationId}, ${d.title}, ${stage.id}, ${d.companyId}, ${d.contactId}, ${d.amount}, ${d.currency ?? ctx.organization.currency},
        ${d.expectedCloseDate}, ${d.ownerMemberId ?? ctx.memberId}, ${stage.kind === "open" ? null : tx`now()`}, ${ctx.userId})
      returning id`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.deal_created", targetType: "crm_deal", targetId: row.id, metadata: { title: d.title, stage: stage.name } });
    return row;
  });
}

export async function updateDeal(ctx: OrgContext, id: string, input: unknown): Promise<void> {
  assertPermission(ctx, "crm.deal.update");
  if (!isUuid(id)) notFound("Deal");
  const d = parseInput(dealSchema, input);
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [cur] = await tx<{ stage_id: string }[]>`select stage_id from crm_deal where id = ${id} and organization_id = ${ctx.organizationId} for update`;
    if (!cur) notFound("Deal");
    const stage = await stageFor(tx, ctx.organizationId, d.stageId ?? cur.stage_id);
    await assertOwnCompany(tx, ctx.organizationId, d.companyId);
    await assertOwnContact(tx, ctx.organizationId, d.contactId);
    await assertOwnMember(tx, ctx.organizationId, d.ownerMemberId);
    await tx`
      update crm_deal set title = ${d.title}, stage_id = ${stage.id}, company_id = ${d.companyId}, contact_id = ${d.contactId}, amount = ${d.amount},
        currency = ${d.currency ?? ctx.organization.currency}, expected_close_date = ${d.expectedCloseDate}, owner_member_id = ${d.ownerMemberId},
        closed_at = ${stage.kind === "open" ? null : tx`coalesce(closed_at, now())`},
        lost_reason = ${stage.kind === "lost" ? tx`lost_reason` : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.deal_updated", targetType: "crm_deal", targetId: id, metadata: { title: d.title } });
  });
}

/** Moves a deal to another stage of the same pipeline. Moving into a won or lost stage closes it. */
export async function moveDeal(ctx: OrgContext, id: string, input: unknown): Promise<{ kind: StageKind }> {
  assertPermission(ctx, "crm.deal.update");
  if (!isUuid(id)) notFound("Deal");
  const d = parseInput(moveDealSchema, input);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [cur] = await tx<{ stage_id: string; title: string }[]>`select stage_id, title from crm_deal where id = ${id} and organization_id = ${ctx.organizationId} for update`;
    if (!cur) notFound("Deal");
    const stage = await stageFor(tx, ctx.organizationId, d.stageId);
    if (stage.id === cur.stage_id) return { kind: stage.kind };
    await tx`
      update crm_deal set stage_id = ${stage.id},
        closed_at = ${stage.kind === "open" ? null : tx`now()`},
        lost_reason = ${stage.kind === "lost" ? d.lostReason : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId}`;
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId,
      action: stage.kind === "won" ? "crm.deal_won" : stage.kind === "lost" ? "crm.deal_lost" : "crm.deal_moved",
      targetType: "crm_deal", targetId: id, metadata: { title: cur.title, stage: stage.name },
    });
    return { kind: stage.kind };
  });
}

export async function setDealArchived(ctx: OrgContext, id: string, archived: boolean): Promise<void> {
  assertPermission(ctx, "crm.deal.update");
  if (!isUuid(id)) notFound("Deal");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ title: string }[]>`
      update crm_deal set archived_at = ${archived ? tx`now()` : null}, updated_at = now()
      where id = ${id} and organization_id = ${ctx.organizationId} returning title`;
    if (!row) notFound("Deal");
    if (archived) await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.deal_archived", targetType: "crm_deal", targetId: id, metadata: { title: row.title } });
    else await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.deal_updated", targetType: "crm_deal", targetId: id, metadata: { title: row.title, restored: true } });
  });
}
