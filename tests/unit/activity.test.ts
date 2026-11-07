import { describe, expect, it } from "vitest";
import { describeActivity, timeAgo, type ActivityRow } from "@/lib/activity";

const row = (over: Partial<ActivityRow>): ActivityRow => ({
  id: "1", action: "organization.created", source: "web", actorName: "Sara Ahmed", subjectName: null, metadata: null, createdAt: new Date(), ...over,
});

describe("describeActivity", () => {
  it("writes member and role events as sentences", () => {
    expect(describeActivity(row({ action: "member.role_changed", subjectName: "Leo Park", metadata: { fromRole: "Employee", toRole: "Manager" } })).text)
      .toBe("changed Leo Park's role from Employee to Manager");
    expect(describeActivity(row({ action: "role.deleted", metadata: {} })).text).toBe("deleted a role");
    expect(describeActivity(row({ action: "organization.updated", metadata: { name: "X", defaultCurrency: "EUR" } })).text)
      .toBe("updated the organization's name, default currency");
  });

  it("credits webhooks to Paddle and maps plan names", () => {
    const item = describeActivity(row({ action: "billing.license_updated", source: "webhook", actorName: null, metadata: { plan: "pacfic_deepdive", status: "past_due" } }));
    expect(item).toMatchObject({ kind: "billing", actor: "Paddle", text: "updated the subscription: Pacfic-DeepDive plan (past due)" });
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  it("uses short relative times, then a date", () => {
    expect(timeAgo(new Date("2026-11-07T11:59:30Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-11-07T11:15:00Z"), now)).toBe("45 min ago");
    expect(timeAgo(new Date("2026-11-07T07:00:00Z"), now)).toBe("5 h ago");
    expect(timeAgo(new Date("2026-11-04T12:00:00Z"), now)).toBe("3 d ago");
    expect(timeAgo(new Date("2026-10-01T12:00:00Z"), now)).toBe("Oct 1");
  });
});
