/**
 * Organization logos and profile pictures: only members see a logo, only
 * editors change it, pictures are visible only inside shared workspaces, and
 * nothing but real PNG/JPEG/WebP is accepted.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, createOrgWithOwner, createUser, db, resetDatabase, setLicense } from "../support/db";
import {
  getAvatar, getOrganizationLogo, removeMyAvatar, removeOrganizationLogo, setMyAvatar, setOrganizationLogo, sniffImageType,
} from "@/server/media/media";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 1, 0, 0, 0, ...Buffer.from("WEBPVP8 "), 1, 2]);
const blob = (b: Uint8Array | string, type = "image/png") => new Blob([typeof b === "string" ? b : Buffer.from(b)], { type });

describe("image checks", () => {
  it("recognises PNG, JPEG and WebP by their bytes, nothing else", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("organization logo", () => {
  beforeEach(resetDatabase);

  it("an editor uploads it, members see it, and it's recorded in the audit log", async () => {
    const a = await createOrgWithOwner("logo-a");
    const { version } = await setOrganizationLogo(a.ctx, blob(PNG));
    expect(version).toBeGreaterThan(0);
    const employee = await addMember(a.org.id, "employee");
    const img = await getOrganizationLogo(employee.user.id, a.org.id);
    expect(img.contentType).toBe("image/png");
    expect(Buffer.from(img.data)).toEqual(Buffer.from(PNG));
    const [org] = await db()<{ logo_updated_at: Date | null }[]>`select logo_updated_at from organization where id = ${a.org.id}`;
    expect(org.logo_updated_at?.getTime()).toBe(version);
    const [audit] = await db()<{ n: number }[]>`select count(*)::int as n from audit_log where organization_id = ${a.org.id} and action = 'organization.logo_updated'`;
    expect(audit.n).toBe(1);

    await removeOrganizationLogo(a.ctx);
    await expect(getOrganizationLogo(employee.user.id, a.org.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("people outside the organization can't see its logo", async () => {
    const a = await createOrgWithOwner("logo-a");
    const b = await createOrgWithOwner("logo-b");
    await setOrganizationLogo(a.ctx, blob(PNG));
    await expect(getOrganizationLogo(b.ctx.userId, a.org.id)).rejects.toBeInstanceOf(NotFoundError);
    const stranger = await createUser();
    await expect(getOrganizationLogo(stranger.id, a.org.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getOrganizationLogo(stranger.id, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("a suspended member can't see it any more", async () => {
    const a = await createOrgWithOwner("logo-a");
    await setOrganizationLogo(a.ctx, blob(PNG));
    const m = await addMember(a.org.id, "employee");
    await db()`update organization_member set status = 'suspended' where id = ${m.member.id}`;
    await expect(getOrganizationLogo(m.user.id, a.org.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("only people who can edit the organization may change it, and only their own organization's", async () => {
    const a = await createOrgWithOwner("logo-a");
    const b = await createOrgWithOwner("logo-b");
    const employee = await addMember(a.org.id, "employee");
    await expect(setOrganizationLogo(employee.ctx, blob(PNG))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(removeOrganizationLogo(employee.ctx)).rejects.toBeInstanceOf(ForbiddenError);
    // B's owner acting through B's context changes only B's logo.
    await setOrganizationLogo(b.ctx, blob(JPEG, "image/jpeg"));
    const [rows] = await db()<{ n: number }[]>`select count(*)::int as n from organization_logo where organization_id = ${a.org.id}`;
    expect(rows.n).toBe(0);
  });

  it("refuses files that aren't PNG, JPEG or WebP, whatever they claim to be, and oversized ones", async () => {
    const a = await createOrgWithOwner("logo-a");
    await expect(setOrganizationLogo(a.ctx, blob('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "image/png"))).rejects.toBeInstanceOf(ValidationError);
    await expect(setOrganizationLogo(a.ctx, blob("<html><script>alert(1)</script></html>", "image/jpeg"))).rejects.toBeInstanceOf(ValidationError);
    await expect(setOrganizationLogo(a.ctx, "not a file")).rejects.toBeInstanceOf(ValidationError);
    await expect(setOrganizationLogo(a.ctx, blob(new Uint8Array()))).rejects.toBeInstanceOf(ValidationError);
    const big = new Uint8Array(512 * 1024 + 1); big.set(PNG);
    await expect(setOrganizationLogo(a.ctx, blob(big))).rejects.toBeInstanceOf(ValidationError);
  });

  it("can't be changed while the workspace is read-only", async () => {
    const a = await createOrgWithOwner("logo-a");
    await setLicense(a.org.id, { plan: "medisea", status: "canceled", periodEndsAt: new Date(Date.now() - 86_400_000) });
    await expect(setOrganizationLogo(a.ctx, blob(PNG))).rejects.toThrow();
    const [rows] = await db()<{ n: number }[]>`select count(*)::int as n from organization_logo`;
    expect(rows.n).toBe(0);
  });
});

describe("profile pictures", () => {
  beforeEach(resetDatabase);

  it("you see your own, and people in your workspace see it too", async () => {
    const a = await createOrgWithOwner("pic-a");
    const colleague = await addMember(a.org.id, "employee");
    await setMyAvatar(colleague.user.id, blob(WEBP, "image/webp"));
    expect((await getAvatar(colleague.user.id, colleague.user.id)).contentType).toBe("image/webp");
    expect((await getAvatar(a.ctx.userId, colleague.user.id)).contentType).toBe("image/webp");
    const [p] = await db()<{ avatar_updated_at: Date | null }[]>`select avatar_updated_at from profile where id = ${colleague.user.id}`;
    expect(p.avatar_updated_at).not.toBeNull();
    await removeMyAvatar(colleague.user.id);
    await expect(getAvatar(a.ctx.userId, colleague.user.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("people who share no workspace with you can't see your picture", async () => {
    const a = await createOrgWithOwner("pic-a");
    const b = await createOrgWithOwner("pic-b");
    await setMyAvatar(a.ctx.userId, blob(PNG));
    await expect(getAvatar(b.ctx.userId, a.ctx.userId)).rejects.toBeInstanceOf(NotFoundError);
    const loner = await createUser();
    await expect(getAvatar(loner.id, a.ctx.userId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getAvatar(loner.id, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("a suspended member no longer sees colleagues' pictures", async () => {
    const a = await createOrgWithOwner("pic-a");
    await setMyAvatar(a.ctx.userId, blob(PNG));
    const m = await addMember(a.org.id, "employee");
    await db()`update organization_member set status = 'suspended' where id = ${m.member.id}`;
    await expect(getAvatar(m.user.id, a.ctx.userId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses files that aren't pictures", async () => {
    const u = await createUser();
    await expect(setMyAvatar(u.id, blob("<svg onload=alert(1)>", "image/svg+xml"))).rejects.toBeInstanceOf(ValidationError);
  });
});
