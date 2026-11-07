import { describe, expect, it } from "vitest";
import { parsePeriod, parseQuestion } from "@/lib/assistant/intents";

const ROLES = ["Owner", "Admin", "HR Manager", "Project Manager", "Employee", "Client / Guest"];
const intent = (q: string) => parseQuestion(q, ROLES).intent;

describe("assistant intents", () => {
  it.each([
    ["How many members do we have?", "member_count"],
    ["kitne log hain team mein", "member_count"],
    ["Who joined recently?", "recent_members"],
    ["naye members kaun hain", "recent_members"],
    ["list all admins", "members_list"],
    ["Which invitations are pending?", "invites_pending"],
    ["What is my role?", "me"],
    ["mera role kya hai", "me"],
    ["What can I do here?", "my_permissions"],
    ["meri permissions dikhao", "my_permissions"],
    ["What did I do this week?", "my_activity"],
    ["How many days are left on our plan?", "plan"],
    ["are we close to our limits", "usage"],
    ["what happened today", "activity"],
    ["aaj kya hua", "activity"],
    ["Who is most active this month?", "top_people"],
    ["What can a Project Manager do?", "role_detail"],
    ["give me a summary", "summary"],
    ["How do I invite someone?", "howto_invite"],
    ["app install kaise karein", "howto_install"],
    ["who is ali@example.com", "member_lookup"],
    ["blah blah", "unknown"],
  ])("%s → %s", (q, expected) => {
    expect(intent(q)).toBe(expected);
  });

  it("extracts roles, people and periods", () => {
    expect(parseQuestion("list all admins", ROLES).role).toBe("Admin");
    expect(parseQuestion("What can an HR Manager do?", ROLES).role).toBe("HR Manager");
    expect(parseQuestion("who is ali@example.com", ROLES).person).toBe("ali@example.com");
    expect(parseQuestion("Who is Sana?", ROLES).person).toBe("sana");
    expect(parsePeriod("changes in the last 14 days")).toEqual({ days: 14, label: "the last 14 days" });
    expect(parsePeriod("pichle hafte")).toMatchObject({ days: 7 });
    expect(parsePeriod("hello")).toBeNull();
  });
});
