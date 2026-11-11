import { describe, expect, it } from "vitest";
import { parseCommand, parseConfirmation } from "@/lib/assistant/commands";

describe("assistant commands", () => {
  it.each([
    ["create a lead Ali Khan ali@example.com", { op: "create", entity: "lead", name: "Ali Khan", email: "ali@example.com" }],
    ["add lead Sara Ahmed from Hunza Travels", { op: "create", entity: "lead", name: "Sara Ahmed", parent: "Hunza Travels" }],
    ["lead banao Bilal Raza", { op: "create", entity: "lead", name: "Bilal Raza" }],
    ["Bilal Raza ka lead banao", { op: "create", entity: "lead", name: "Bilal Raza" }],
    ["create task Homepage design in Hunza booking site", { op: "create", entity: "task", name: "Homepage design", parent: "Hunza booking site" }],
    ["new task: Fix login bug on Internal tools project", { op: "create", entity: "task", name: "Fix login bug", parent: "Internal tools" }],
    ["create project Gwadar Ports website", { op: "create", entity: "project", name: "Gwadar Ports website" }],
    ["project banao Lahore Bakehouse app", { op: "create", entity: "project", name: "Lahore Bakehouse app" }],
    ["add company Margalla Clinics", { op: "create", entity: "company", name: "Margalla Clinics" }],
    ["add vendor CloudNest Hosting", { op: "create", entity: "vendor", name: "CloudNest Hosting" }],
    ["add expense 4500 for printer ink", { op: "create", entity: "expense", amount: 4500, name: "printer ink" }],
    ["create department Design", { op: "create", entity: "department", name: "Design" }],
    ["invite ali@example.com as Project Manager", { op: "create", entity: "invitation", email: "ali@example.com", role: "Project Manager" }],
    ["log 2h on Hunza booking site", { op: "create", entity: "time", minutes: 120, parent: "Hunza booking site" }],
    ["log 1:30 on Homepage in Hunza booking site yesterday", { op: "create", entity: "time", minutes: 90, name: "Homepage", parent: "Hunza booking site", daysAgo: 1 }],
    ["add 45m", { op: "create", entity: "time", minutes: 45 }],
    ["start timer for Homepage on Hunza booking site", { op: "start", entity: "timer", name: "Homepage", parent: "Hunza booking site" }],
    ["timer band karo", { op: "stop", entity: "timer" }],
    ["delete task Homepage design", { op: "delete", entity: "task", name: "Homepage design" }],
    ["archive lead Ali Khan", { op: "delete", entity: "lead", name: "Ali Khan" }],
    ["Ali Khan wala lead delete karo", { op: "delete", entity: "lead", name: "Ali Khan" }],
    ["remove vendor CloudNest Hosting", { op: "delete", entity: "vendor", name: "CloudNest Hosting" }],
    ["delete invoice INV-3", { op: "delete", entity: "invoice", name: "INV-0003" }],
    ["delete draft estimate est 12", { op: "delete", entity: "estimate", name: "EST-0012" }],
    ["cancel invite ali@example.com", { op: "delete", entity: "invitation", email: "ali@example.com" }],
    ["project Old site hatao", { op: "delete", entity: "project", name: "Old site" }],
  ])("%s", (q, expected) => {
    expect(parseCommand(q)).toMatchObject(expected);
  });

  it("leaves questions alone", () => {
    for (const q of ["How many leads do we have?", "Who is on leave today?", "give me a summary", "what can a project manager do", "create an invoice for Hunza"]) {
      expect(parseCommand(q)).toBeNull();
    }
  });

  it("reads yes and no in English and Roman Urdu", () => {
    for (const y of ["yes", "Haan", "confirm", "ok", "kar do", "go ahead"]) expect(parseConfirmation(y)).toBe(true);
    for (const n of ["no", "Nahi", "cancel", "rehne do"]) expect(parseConfirmation(n)).toBe(false);
    expect(parseConfirmation("yes but change the name")).toBeNull();
  });
});
