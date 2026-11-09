import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { assertWritable } from "@/server/billing/license";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import type { PermissionKey } from "@/server/permissions/catalog";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { noteSchema, type NOTE_SUBJECTS } from "@/lib/validation/crm";
import { notFound } from "./shared";

export type NoteSubject = (typeof NOTE_SUBJECTS)[number];
export interface NoteRow { id: string; body: string; author: string; mine: boolean; createdAt: Date }

const TABLE = { lead: "crm_lead", contact: "crm_contact", company: "crm_company", deal: "crm_deal" } as const;
const READ: Record<NoteSubject, PermissionKey> = { lead: "crm.lead.read", contact: "crm.contact.read", company: "crm.contact.read", deal: "crm.deal.read" };
const WRITE: Record<NoteSubject, PermissionKey> = { lead: "crm.lead.update", contact: "crm.contact.manage", company: "crm.contact.manage", deal: "crm.deal.update" };

/** Notes on one record, newest first. Needs permission to see that kind of record. */
export async function listNotes(ctx: OrgContext, subjectType: NoteSubject, subjectId: string): Promise<NoteRow[]> {
  assertPermission(ctx, READ[subjectType]);
  if (!isUuid(subjectId)) return [];
  const rows = await getDb()<{ id: string; body: string; author: string | null; author_id: string | null; created_at: Date }[]>`
    select n.id, n.body, p.name as author, n.author_id, n.created_at
    from crm_note n left join profile p on p.id = n.author_id
    where n.organization_id = ${ctx.organizationId} and n.subject_type = ${subjectType} and n.subject_id = ${subjectId}
    order by n.created_at desc limit 200`;
  return rows.map((r) => ({ id: r.id, body: r.body, author: r.author ?? "Former member", mine: r.author_id === ctx.userId, createdAt: r.created_at }));
}

export async function addNote(ctx: OrgContext, input: unknown): Promise<{ id: string }> {
  const d = parseInput(noteSchema, input);
  assertPermission(ctx, WRITE[d.subjectType]);
  if (!isUuid(d.subjectId)) notFound("Record");
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    // The record must belong to this organization.
    const [own] = await tx`select 1 from ${tx(TABLE[d.subjectType])} where id = ${d.subjectId} and organization_id = ${ctx.organizationId}`;
    if (!own) notFound("Record");
    const [row] = await tx<{ id: string }[]>`
      insert into crm_note (organization_id, subject_type, subject_id, body, author_id)
      values (${ctx.organizationId}, ${d.subjectType}, ${d.subjectId}, ${d.body}, ${ctx.userId}) returning id`;
    // The audit entry names the record, never the note's words.
    await recordAudit(tx, { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "crm.note_added", targetType: TABLE[d.subjectType], targetId: d.subjectId, metadata: { subject: d.subjectType } });
    return row;
  });
}

/** People can delete their own notes. */
export async function deleteNote(ctx: OrgContext, id: string): Promise<void> {
  if (!isUuid(id)) notFound("Note");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [n] = await tx<{ subject_type: NoteSubject }[]>`
      select subject_type from crm_note where id = ${id} and organization_id = ${ctx.organizationId} and author_id = ${ctx.userId}`;
    if (!n) notFound("Note");
    assertPermission(ctx, READ[n.subject_type]);
    await tx`delete from crm_note where id = ${id} and organization_id = ${ctx.organizationId} and author_id = ${ctx.userId}`;
  });
}
