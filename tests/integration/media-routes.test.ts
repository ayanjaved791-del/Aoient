/** The image URLs: members get the picture with safe headers; everyone else gets the same 404. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addMember, createOrgWithOwner, createUser, resetDatabase } from "../support/db";
import { setMyAvatar, setOrganizationLogo } from "@/server/media/media";

const sessionUser = vi.hoisted(() => ({ current: null as null | { id: string } }));
vi.mock("@/server/auth/session", () => ({ getSessionUser: async () => sessionUser.current }));

const { GET: getLogo } = await import("@/app/api/media/org-logo/[orgId]/route");
const { GET: getAvatarRoute } = await import("@/app/api/media/avatar/[userId]/route");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const logo = (orgId: string) => getLogo(new Request("https://a.test"), { params: Promise.resolve({ orgId }) });
const avatar = (userId: string) => getAvatarRoute(new Request("https://a.test"), { params: Promise.resolve({ userId }) });

describe("media routes", () => {
  beforeEach(resetDatabase);

  it("serves the logo to members with locked-down headers", async () => {
    const a = await createOrgWithOwner("route-a");
    await setOrganizationLogo(a.ctx, new Blob([Buffer.from(PNG)]));
    const member = await addMember(a.org.id, "employee");
    sessionUser.current = { id: member.user.id };
    const res = await logo(a.org.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from(PNG));
  });

  it("answers 404 to signed-out visitors and other organizations alike", async () => {
    const a = await createOrgWithOwner("route-a");
    const b = await createOrgWithOwner("route-b");
    await setOrganizationLogo(a.ctx, new Blob([Buffer.from(PNG)]));
    await setMyAvatar(a.ctx.userId, new Blob([Buffer.from(PNG)]));

    sessionUser.current = null;
    expect((await logo(a.org.id)).status).toBe(404);
    expect((await avatar(a.ctx.userId)).status).toBe(404);

    sessionUser.current = { id: b.ctx.userId };
    const res = await logo(a.org.id);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await avatar(a.ctx.userId)).status).toBe(404);
    // Same answer as an organization that doesn't exist.
    expect((await logo("00000000-0000-0000-0000-000000000000")).status).toBe(404);

    const stranger = await createUser();
    sessionUser.current = { id: stranger.id };
    expect((await avatar(a.ctx.userId)).status).toBe(404);
  });
});
