/** Ctrl+K search: only this organization, only what the role can open, only visible projects. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, resetDatabase } from "../support/db";
import { searchWorkspace } from "@/server/search/search";
import { createProject } from "@/server/projects/projects";
import { createTask } from "@/server/projects/tasks";
import { createLead } from "@/server/crm/leads";
import { createCompany } from "@/server/crm/contacts";
import { createDocument } from "@/server/finance/documents";
import { createVendor } from "@/server/finance/vendors";

const groups = (hits: { group: string }[]) => [...new Set(hits.map((h) => h.group))].sort();

describe("workspace search", () => {
  beforeEach(resetDatabase);

  it("finds records across modules, within the role", async () => {
    const { org, ctx: owner } = await createOrgWithOwner("search-a");
    const emp = await addMember(org.id, "employee");
    const shared = await createProject(owner, { name: "Hunza booking site", memberIds: [emp.member.id] });
    await createTask(owner, shared.id, { title: "Hunza homepage" });
    const secret = await createProject(owner, { name: "Hunza secret pitch" });
    await createTask(owner, secret.id, { title: "Hunza pricing" });
    await createLead(owner, { fullName: "Hunza lead person" });
    await createCompany(owner, { name: "Hunza Travels" });
    await createDocument(owner, "invoice", { billToName: "Hunza Travels", issueDate: "2026-11-01", lines: [{ description: "Work", quantity: 1, unitPrice: 10 }] });
    await createVendor(owner, { name: "Hunza Cabs" });

    expect(groups(await searchWorkspace(owner, "hunza"))).toEqual(["Companies", "Invoices", "Leads", "Projects", "Tasks", "Vendors"]);
    const mine = await searchWorkspace(emp.ctx, "hunza");
    expect(groups(mine)).toEqual(["Projects", "Tasks"]);
    expect(mine.map((h) => h.title).sort()).toEqual(["Hunza booking site", "Hunza homepage"]);
    expect((await searchWorkspace(owner, "INV-1")).map((h) => h.title)).toEqual(["INV-0001"]);
    expect(await searchWorkspace(owner, "h")).toEqual([]);
  });

  it("never returns another organization's records", async () => {
    const a = await createOrgWithOwner("search-victim");
    const b = await createOrgWithOwner("search-attacker");
    await createProject(a.ctx, { name: "Zebra project" });
    await createCompany(a.ctx, { name: "Zebra Ltd" });
    await createVendor(a.ctx, { name: "Zebra supplies" });
    expect(await searchWorkspace(b.ctx, "zebra")).toEqual([]);
    expect((await searchWorkspace(a.ctx, "zebra")).length).toBe(3);
    // Wildcards are treated as text.
    expect(await searchWorkspace(b.ctx, "%%")).toEqual([]);
  });
});
