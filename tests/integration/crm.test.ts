/** CRM: companies, contacts, leads, pipeline, deals, notes and reports — one organization at a time, by role. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, db, resetDatabase } from "../support/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createCompany, createContact, getCompany, getContact, listCompanies, listContacts, setContactArchived, updateContact } from "@/server/crm/contacts";
import { convertLead, createLead, getLead, listLeads, updateLead } from "@/server/crm/leads";
import { createDeal, createStage, deleteStage, getDeal, listDeals, listStages, moveDeal, reorderStages, updateDeal, updateStage } from "@/server/crm/deals";
import { addNote, deleteNote, listNotes } from "@/server/crm/notes";
import { getCrmReport } from "@/server/crm/reports";

async function setup() {
  const a = await createOrgWithOwner("crm-a");
  const sales = await addMember(a.org.id, "sales_manager");
  const pm = await addMember(a.org.id, "project_manager");
  const worker = await addMember(a.org.id, "employee");
  const guest = await addMember(a.org.id, "guest");
  const b = await createOrgWithOwner("crm-b");
  const bCompany = await createCompany(b.ctx, { name: "Bravo Secret Co" });
  const bContact = await createContact(b.ctx, { fullName: "Hidden Hadi", email: "hadi@b.test", companyId: bCompany.id });
  const bDeal = await createDeal(b.ctx, { title: "B's private deal", amount: 999, contactId: bContact.id });
  const bStages = await listStages(b.ctx);
  return { a, sales, pm, worker, guest, b, bCompany, bContact, bDeal, bStages };
}

describe("crm", () => {
  beforeEach(resetDatabase);

  it("runs the sales flow: lead → contact, company and deal → won, and reports it", async () => {
    const s = await setup();
    const stages = await listStages(s.sales.ctx);
    expect(stages.map((x) => x.name)).toEqual(["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]);

    const lead = await createLead(s.sales.ctx, { fullName: "Ayesha Noor", email: "AYESHA@client.test", companyName: "Client Co", source: "referral", estimatedValue: "1,500" });
    expect(await getLead(s.sales.ctx, lead.id)).toMatchObject({ email: "ayesha@client.test", estimatedValue: 1500, status: "new", owner: { id: s.sales.member.id } });
    await updateLead(s.sales.ctx, lead.id, { fullName: "Ayesha Noor", email: "ayesha@client.test", companyName: "Client Co", source: "referral", status: "qualified", estimatedValue: 1500 });

    const conv = await convertLead(s.sales.ctx, lead.id, { createDeal: true });
    expect(conv.companyId).toBeTruthy();
    expect((await getContact(s.sales.ctx, conv.contactId)).company?.name).toBe("Client Co");
    const deal = await getDeal(s.sales.ctx, conv.dealId!);
    expect(deal).toMatchObject({ title: "Client Co deal", amount: 1500, currency: "USD", stage: { name: "New", kind: "open" } });
    await expect(convertLead(s.sales.ctx, lead.id, { createDeal: true })).rejects.toBeInstanceOf(ConflictError);
    await expect(updateLead(s.sales.ctx, lead.id, { fullName: "Changed" })).rejects.toBeInstanceOf(ConflictError);

    // A second lead from the same company and email reuses both records.
    const again = await createLead(s.sales.ctx, { fullName: "Ayesha N.", email: "ayesha@client.test", companyName: "client co" });
    const conv2 = await convertLead(s.sales.ctx, again.id, { createDeal: false });
    expect(conv2).toMatchObject({ contactId: conv.contactId, companyId: conv.companyId, dealId: null });

    const won = stages.find((x) => x.kind === "won")!;
    expect(await moveDeal(s.sales.ctx, deal.id, { stageId: won.id })).toEqual({ kind: "won" });
    const closed = await getDeal(s.sales.ctx, deal.id);
    expect(closed.closedAt).toBeInstanceOf(Date);
    await moveDeal(s.sales.ctx, deal.id, { stageId: stages[1].id });
    expect((await getDeal(s.sales.ctx, deal.id)).closedAt).toBeNull();
    await moveDeal(s.sales.ctx, deal.id, { stageId: won.id });

    await createDeal(s.sales.ctx, { title: "Open one", amount: 1000, stageId: stages[2].id }); // Proposal, 50%
    await createDeal(s.sales.ctx, { title: "Euro one", amount: 700, currency: "EUR" });
    const report = await getCrmReport(s.sales.ctx);
    expect(report).toMatchObject({
      currency: "USD", openValue: 1000, weightedValue: 500, openCount: 2,
      wonThisMonth: { count: 1, value: 1500 }, lostThisMonth: 0, winRate: 100, averageWon: 1500, conversionRate: 100,
      otherCurrencies: [{ currency: "EUR", openValue: 700, count: 1 }],
    });
    expect(report.leadsBySource).toEqual(expect.arrayContaining([{ source: "referral", count: 1 }]));
    expect(report.wonByMonth.at(-1)).toEqual(expect.objectContaining({ value: 1500, count: 1 }));
    expect(JSON.stringify(report)).not.toContain("999");
  });

  it("never reads, changes or links another organization's CRM records", async () => {
    const s = await setup();
    const company = await createCompany(s.a.ctx, { name: "Alpha Co" });
    expect(JSON.stringify(await listCompanies(s.a.ctx))).not.toContain("Bravo");
    expect(JSON.stringify(await listContacts(s.a.ctx))).not.toContain("Hidden Hadi");
    expect(JSON.stringify(await listDeals(s.a.ctx))).not.toContain("private deal");
    await expect(getCompany(s.a.ctx, s.bCompany.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getContact(s.a.ctx, s.bContact.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getDeal(s.a.ctx, s.bDeal.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateContact(s.a.ctx, s.bContact.id, { fullName: "Hijack" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setContactArchived(s.a.ctx, s.bContact.id, true)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateDeal(s.a.ctx, s.bDeal.id, { title: "Hijack" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(moveDeal(s.a.ctx, s.bDeal.id, { stageId: s.bStages[1].id })).rejects.toBeInstanceOf(NotFoundError);

    // Foreign ids in links are refused.
    await expect(createContact(s.a.ctx, { fullName: "X Person", companyId: s.bCompany.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(createDeal(s.a.ctx, { title: "X deal", contactId: s.bContact.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(createDeal(s.a.ctx, { title: "X deal", stageId: s.bStages[0].id })).rejects.toBeInstanceOf(ValidationError);
    await expect(createDeal(s.a.ctx, { title: "X deal", ownerMemberId: s.b.ctx.memberId })).rejects.toBeInstanceOf(ValidationError);
    const mine = await createDeal(s.a.ctx, { title: "Mine", companyId: company.id });
    await expect(moveDeal(s.a.ctx, mine.id, { stageId: s.bStages[4].id })).rejects.toBeInstanceOf(ValidationError);
    await expect(reorderStages(s.a.ctx, { ids: s.bStages.map((x) => x.id) })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateStage(s.a.ctx, s.bStages[0].id, { name: "Hacked" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(addNote(s.a.ctx, { subjectType: "deal", subjectId: s.bDeal.id, body: "peek" })).rejects.toBeInstanceOf(NotFoundError);
    expect(await listNotes(s.a.ctx, "deal", s.bDeal.id)).toEqual([]);

    // Even a hand-written insert can't link across organizations: the database refuses it.
    await expect(db()`update crm_deal set company_id = ${s.bCompany.id} where id = ${mine.id}`).rejects.toThrow(/foreign key/);
    expect((await getDeal(s.b.ctx, s.bDeal.id)).title).toBe("B's private deal");
  });

  it("gives each role only its CRM permissions", async () => {
    const s = await setup();
    // Project managers can look at contacts and deals but not change them, or see leads and reports.
    expect(await listDeals(s.pm.ctx)).toEqual([]);
    expect(await listContacts(s.pm.ctx)).toEqual([]);
    await expect(createDeal(s.pm.ctx, { title: "No" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createContact(s.pm.ctx, { fullName: "No One" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listLeads(s.pm.ctx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getCrmReport(s.pm.ctx)).rejects.toBeInstanceOf(ForbiddenError);
    // Employees and guests have no CRM access.
    for (const who of [s.worker, s.guest]) {
      await expect(listDeals(who.ctx)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listLeads(who.ctx)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listCompanies(who.ctx)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(createLead(who.ctx, { fullName: "Nope Nope" })).rejects.toBeInstanceOf(ForbiddenError);
    }
    // Only pipeline managers change stages.
    const stages = await listStages(s.pm.ctx);
    await expect(createStage(s.pm.ctx, { name: "Demo" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteStage(s.pm.ctx, stages[0].id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("keeps the pipeline sensible", async () => {
    const s = await setup();
    const stages = await listStages(s.sales.ctx);
    const demo = await createStage(s.sales.ctx, { name: "Demo booked", probability: 40 });
    const after = await listStages(s.sales.ctx);
    expect(after.map((x) => x.name)).toEqual(["New", "Qualified", "Proposal", "Negotiation", "Demo booked", "Won", "Lost"]);
    await expect(createStage(s.sales.ctx, { name: "demo BOOKED" })).rejects.toBeInstanceOf(ConflictError);

    const deal = await createDeal(s.sales.ctx, { title: "In demo", stageId: demo.id });
    await expect(deleteStage(s.sales.ctx, demo.id)).rejects.toBeInstanceOf(ConflictError);
    await moveDeal(s.sales.ctx, deal.id, { stageId: stages[0].id });
    await deleteStage(s.sales.ctx, demo.id);

    // At least one open stage must remain.
    const opens = stages.filter((x) => x.kind === "open");
    for (const o of opens.slice(1)) await deleteStage(s.sales.ctx, o.id);
    await expect(updateStage(s.sales.ctx, opens[0].id, { name: "New", kind: "won" })).rejects.toBeInstanceOf(ValidationError);
    await expect(deleteStage(s.sales.ctx, opens[0].id)).rejects.toBeInstanceOf(ConflictError); // still holds the deal

    const order = (await listStages(s.sales.ctx)).map((x) => x.id).reverse();
    await reorderStages(s.sales.ctx, { ids: order });
    expect((await listStages(s.sales.ctx)).map((x) => x.id)).toEqual(order);
    await expect(reorderStages(s.sales.ctx, { ids: order.slice(1) })).rejects.toBeInstanceOf(ValidationError);
  });

  it("notes: added by people who can edit the record, deleted only by their author", async () => {
    const s = await setup();
    const deal = await createDeal(s.sales.ctx, { title: "Noted" });
    const note = await addNote(s.sales.ctx, { subjectType: "deal", subjectId: deal.id, body: "Sent the proposal" });
    expect((await listNotes(s.pm.ctx, "deal", deal.id)).map((n) => n.body)).toEqual(["Sent the proposal"]);
    await expect(addNote(s.pm.ctx, { subjectType: "deal", subjectId: deal.id, body: "Me too" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteNote(s.a.ctx, note.id)).rejects.toBeInstanceOf(NotFoundError);
    await deleteNote(s.sales.ctx, note.id);
    expect(await listNotes(s.sales.ctx, "deal", deal.id)).toEqual([]);
    // The audit trail never stores the note's words.
    const audit = await db()<{ metadata: unknown }[]>`select metadata from audit_log where action = 'crm.note_added'`;
    expect(JSON.stringify(audit)).not.toContain("proposal");
  });
});
