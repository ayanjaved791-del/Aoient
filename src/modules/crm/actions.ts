"use server";
/**
 * CRM server actions. Each re-authenticates, re-resolves the workspace from
 * the slug (membership verified on the server), then calls the service, which
 * checks the permission for that exact operation. Ids from the browser are
 * only ever used together with the verified organization.
 */
import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import { createCompany, createContact, setCompanyArchived, setContactArchived, updateCompany, updateContact } from "@/server/crm/contacts";
import { convertLead, createLead, setLeadArchived, updateLead } from "@/server/crm/leads";
import { createDeal, createStage, deleteStage, moveDeal, reorderStages, setDealArchived, updateDeal, updateStage } from "@/server/crm/deals";
import { addNote, deleteNote } from "@/server/crm/notes";

async function ctxFor(slug: string) {
  const user = await requireUser();
  return resolveOrgContext(user.id, { slug: String(slug) });
}
const done = <T>(v: T) => { refresh(); return v; };

export async function createCompanyAction(slug: string, input: unknown) {
  return runAction(async () => done(await createCompany(await ctxFor(slug), input)));
}
export async function updateCompanyAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateCompany(await ctxFor(slug), String(id), input)));
}
export async function setCompanyArchivedAction(slug: string, id: string, archived: boolean) {
  return runAction(async () => done(await setCompanyArchived(await ctxFor(slug), String(id), archived === true)));
}
export async function createContactAction(slug: string, input: unknown) {
  return runAction(async () => done(await createContact(await ctxFor(slug), input)));
}
export async function updateContactAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateContact(await ctxFor(slug), String(id), input)));
}
export async function setContactArchivedAction(slug: string, id: string, archived: boolean) {
  return runAction(async () => done(await setContactArchived(await ctxFor(slug), String(id), archived === true)));
}
export async function createLeadAction(slug: string, input: unknown) {
  return runAction(async () => done(await createLead(await ctxFor(slug), input)));
}
export async function updateLeadAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateLead(await ctxFor(slug), String(id), input)));
}
export async function setLeadArchivedAction(slug: string, id: string, archived: boolean) {
  return runAction(async () => done(await setLeadArchived(await ctxFor(slug), String(id), archived === true)));
}
export async function convertLeadAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await convertLead(await ctxFor(slug), String(id), input)));
}
export async function createDealAction(slug: string, input: unknown) {
  return runAction(async () => done(await createDeal(await ctxFor(slug), input)));
}
export async function updateDealAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateDeal(await ctxFor(slug), String(id), input)));
}
export async function moveDealAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await moveDeal(await ctxFor(slug), String(id), input)));
}
export async function setDealArchivedAction(slug: string, id: string, archived: boolean) {
  return runAction(async () => done(await setDealArchived(await ctxFor(slug), String(id), archived === true)));
}
export async function createStageAction(slug: string, input: unknown) {
  return runAction(async () => done(await createStage(await ctxFor(slug), input)));
}
export async function updateStageAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateStage(await ctxFor(slug), String(id), input)));
}
export async function deleteStageAction(slug: string, id: string) {
  return runAction(async () => done(await deleteStage(await ctxFor(slug), String(id))));
}
export async function reorderStagesAction(slug: string, input: unknown) {
  return runAction(async () => done(await reorderStages(await ctxFor(slug), input)));
}
export async function addNoteAction(slug: string, input: unknown) {
  return runAction(async () => done(await addNote(await ctxFor(slug), input)));
}
export async function deleteNoteAction(slug: string, id: string) {
  return runAction(async () => done(await deleteNote(await ctxFor(slug), String(id))));
}
