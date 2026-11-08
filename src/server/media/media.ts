import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { recordAudit } from "@/server/audit/audit";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { assertPermission, resolveOrgContext, type OrgContext } from "@/server/tenancy/context";
import { assertWritable } from "@/server/billing/license";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";

/**
 * Organization logos and profile pictures. The browser shrinks the picture
 * before upload; the server still checks the real file type from its first
 * bytes (never the name or the type the browser claims) and its size, and
 * only accepts PNG, JPEG and WebP, so nothing that can run script (SVG, HTML)
 * is ever stored or served.
 */

export const MAX_IMAGE_BYTES = 512 * 1024;
export type ImageType = "image/png" | "image/jpeg" | "image/webp";

export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Reads an uploaded File (from a form) into checked bytes. */
export async function readImageUpload(file: unknown): Promise<{ bytes: Uint8Array; type: ImageType }> {
  if (!(file instanceof Blob) || file.size === 0) throw new ValidationError("Choose a picture to upload.");
  if (file.size > MAX_IMAGE_BYTES) throw new ValidationError("That picture is too large. Use one under 512 KB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw new ValidationError("Use a PNG, JPG or WebP picture.");
  return { bytes, type };
}

export interface StoredImage {
  data: Uint8Array;
  contentType: ImageType;
  updatedAt: Date;
}

/* ─────────────────────────── organization logo ─────────────────────────── */

export async function setOrganizationLogo(ctx: OrgContext, file: unknown): Promise<{ version: number }> {
  assertPermission(ctx, "organization.update");
  await enforceRateLimit(`media:org:${ctx.organizationId}`, { max: 30, windowSeconds: 3600 });
  const { bytes, type } = await readImageUpload(file);
  return transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const [row] = await tx<{ updated_at: Date }[]>`
      insert into organization_logo (organization_id, content_type, data, updated_at)
      values (${ctx.organizationId}, ${type}, ${bytes}, now())
      on conflict (organization_id) do update set content_type = excluded.content_type, data = excluded.data, updated_at = now()
      returning updated_at`;
    await tx`update organization set logo_updated_at = ${row.updated_at}, updated_at = now() where id = ${ctx.organizationId}`;
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "organization.logo_updated",
      targetType: "organization", targetId: ctx.organizationId, metadata: { type, bytes: bytes.length },
    });
    return { version: row.updated_at.getTime() };
  });
}

export async function removeOrganizationLogo(ctx: OrgContext): Promise<void> {
  assertPermission(ctx, "organization.update");
  await transaction(async (tx) => {
    await assertWritable(tx, ctx.organizationId);
    const gone = await tx`delete from organization_logo where organization_id = ${ctx.organizationId}`;
    await tx`update organization set logo_updated_at = null, updated_at = now() where id = ${ctx.organizationId}`;
    if (gone.count > 0) {
      await recordAudit(tx, {
        organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "organization.logo_removed",
        targetType: "organization", targetId: ctx.organizationId, metadata: {},
      });
    }
  });
}

/** Only active members of the organization may see its logo; everyone else gets "not found". */
export async function getOrganizationLogo(viewerId: string, organizationId: string): Promise<StoredImage> {
  const ctx = await resolveOrgContext(viewerId, { id: organizationId });
  const [row] = await getDb()<{ data: Uint8Array; content_type: ImageType; updated_at: Date }[]>`
    select data, content_type, updated_at from organization_logo where organization_id = ${ctx.organizationId}`;
  if (!row) throw new NotFoundError();
  return { data: row.data, contentType: row.content_type, updatedAt: row.updated_at };
}

/* ─────────────────────────── profile picture ─────────────────────────── */

export async function setMyAvatar(userId: string, file: unknown): Promise<{ version: number }> {
  await enforceRateLimit(`media:user:${userId}`, { max: 30, windowSeconds: 3600 });
  const { bytes, type } = await readImageUpload(file);
  return transaction(async (tx) => {
    const [row] = await tx<{ updated_at: Date }[]>`
      insert into profile_avatar (user_id, content_type, data, updated_at)
      values (${userId}, ${type}, ${bytes}, now())
      on conflict (user_id) do update set content_type = excluded.content_type, data = excluded.data, updated_at = now()
      returning updated_at`;
    await tx`update profile set avatar_updated_at = ${row.updated_at}, updated_at = now() where id = ${userId}`;
    return { version: row.updated_at.getTime() };
  });
}

export async function removeMyAvatar(userId: string): Promise<void> {
  await transaction(async (tx) => {
    await tx`delete from profile_avatar where user_id = ${userId}`;
    await tx`update profile set avatar_updated_at = null, updated_at = now() where id = ${userId}`;
  });
}

/**
 * You can see your own picture, and the picture of anyone in a workspace
 * where you are an active member. Anyone else's reads as "not found".
 */
export async function getAvatar(viewerId: string, userId: string): Promise<StoredImage> {
  if (!isUuid(viewerId) || !isUuid(userId)) throw new NotFoundError();
  const sql = getDb();
  if (viewerId !== userId) {
    const [shared] = await sql`
      select 1
      from organization_member mine
      join organization_member theirs on theirs.organization_id = mine.organization_id
      join organization o on o.id = mine.organization_id
      where mine.user_id = ${viewerId} and mine.status = 'active'
        and theirs.user_id = ${userId}
        and o.status = 'active'
      limit 1`;
    if (!shared) throw new NotFoundError();
  }
  const [row] = await sql<{ data: Uint8Array; content_type: ImageType; updated_at: Date }[]>`
    select data, content_type, updated_at from profile_avatar where user_id = ${userId}`;
  if (!row) throw new NotFoundError();
  return { data: row.data, contentType: row.content_type, updatedAt: row.updated_at };
}
