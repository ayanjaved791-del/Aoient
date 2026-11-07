/** The overview's activity feed reads only the caller's organization, and only with audit access. */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, resetDatabase } from "../support/db";
import { ForbiddenError } from "@/lib/errors";
import { listRecentActivity } from "@/server/audit/activity";
import { createCustomRole } from "@/server/organizations/roles";
import { createInvitation } from "@/server/organizations/invitations";

describe("recent activity", () => {
  beforeEach(resetDatabase);

  it("shows the organization's own events, newest first, with readable sentences", async () => {
    const a = await createOrgWithOwner("act-a");
    const role = await createCustomRole(a.ctx, { name: "Reviewer", permissions: ["organization.read"] });
    await createInvitation(a.ctx, { email: "new.hire@a.test", roleId: role.id });

    const items = await listRecentActivity(a.ctx);
    expect(items.map((i) => i.text)).toEqual(["invited new.hire@a.test as Reviewer", "created the Reviewer role", "created Org act-a"]);
    expect(items.every((i) => i.actor === a.user.name)).toBe(true);
  });

  it("never includes another organization's events", async () => {
    const a = await createOrgWithOwner("act-a");
    const b = await createOrgWithOwner("act-b");
    await createCustomRole(b.ctx, { name: "Secret B role", permissions: ["organization.read"] });
    await createInvitation(b.ctx, { email: "someone@b.test", roleId: (await createCustomRole(b.ctx, { name: "B2", permissions: [] })).id });

    const texts = (await listRecentActivity(a.ctx, 50)).map((i) => i.text).join("\n");
    expect(texts).toBe("created Org act-a");
    expect(texts).not.toMatch(/Secret B|someone@b\.test|act-b/);
  });

  it("is refused for members without audit access", async () => {
    const a = await createOrgWithOwner("act-a");
    const employee = await addMember(a.org.id, "employee");
    await expect(listRecentActivity(employee.ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
