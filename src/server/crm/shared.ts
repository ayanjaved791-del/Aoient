import "server-only";
import type { Db } from "@/server/database/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";

/**
 * Checks that ids sent from the browser name rows in this organization before
 * they're linked. The database's (organization_id, id) foreign keys refuse a
 * cross-organization link as well; this gives a clear message first.
 */
async function assertOwn(tx: Db, table: "crm_company" | "crm_contact" | "crm_stage", organizationId: string, id: string | null, what: string) {
  if (!id) return;
  if (!isUuid(id)) throw new ValidationError(`Pick a valid ${what}`, { [what]: [`Pick a valid ${what}`] });
  const [row] = await tx`select 1 from ${tx(table)} where id = ${id} and organization_id = ${organizationId}`;
  if (!row) throw new ValidationError(`Pick a valid ${what}`, { [what]: [`Pick a valid ${what}`] });
}

export const assertOwnCompany = (tx: Db, org: string, id: string | null) => assertOwn(tx, "crm_company", org, id, "company");
export const assertOwnContact = (tx: Db, org: string, id: string | null) => assertOwn(tx, "crm_contact", org, id, "contact");

/** A record owner must be an active member of this organization. */
export async function assertOwnMember(tx: Db, organizationId: string, memberId: string | null) {
  if (!memberId) return;
  if (!isUuid(memberId)) throw new ValidationError("Pick a valid owner", { owner: ["Pick a valid owner"] });
  const [row] = await tx`select 1 from organization_member where id = ${memberId} and organization_id = ${organizationId} and status = 'active'`;
  if (!row) throw new ValidationError("Pick a valid owner", { owner: ["Pick a valid owner"] });
}

export const DEFAULT_STAGES = [
  { name: "New", kind: "open", probability: 10 },
  { name: "Qualified", kind: "open", probability: 25 },
  { name: "Proposal", kind: "open", probability: 50 },
  { name: "Negotiation", kind: "open", probability: 75 },
  { name: "Won", kind: "won", probability: 100 },
  { name: "Lost", kind: "lost", probability: 0 },
] as const;

/** Every organization starts with a ready pipeline; it's created the first time the CRM is used. */
export async function ensureStages(tx: Db, organizationId: string): Promise<void> {
  const [has] = await tx`select 1 from crm_stage where organization_id = ${organizationId} limit 1`;
  if (has) return;
  for (const [i, s] of DEFAULT_STAGES.entries()) {
    await tx`insert into crm_stage (organization_id, name, position, kind, probability)
      values (${organizationId}, ${s.name}, ${i}, ${s.kind}, ${s.probability})
      on conflict do nothing`;
  }
}

export async function stageFor(tx: Db, organizationId: string, stageId: string | null): Promise<{ id: string; kind: "open" | "won" | "lost"; name: string }> {
  if (stageId) {
    if (!isUuid(stageId)) throw new ValidationError("Pick a valid stage", { stage: ["Pick a valid stage"] });
    const [row] = await tx<{ id: string; kind: "open" | "won" | "lost"; name: string }[]>`
      select id, kind, name from crm_stage where id = ${stageId} and organization_id = ${organizationId}`;
    if (!row) throw new ValidationError("Pick a valid stage", { stage: ["Pick a valid stage"] });
    return row;
  }
  await ensureStages(tx, organizationId);
  const [first] = await tx<{ id: string; kind: "open" | "won" | "lost"; name: string }[]>`
    select id, kind, name from crm_stage where organization_id = ${organizationId} and kind = 'open' order by position limit 1`;
  if (!first) throw new ValidationError("Add an open stage to the pipeline first");
  return first;
}

export function notFound(what: string): never {
  throw new NotFoundError(`${what} not found`);
}
