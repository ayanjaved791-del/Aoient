import "server-only";
import { avatarUrl, orgLogoUrl } from "@/lib/media";
import { getDb, transaction, type Db } from "@/server/database/client";
import { isUniqueViolation } from "@/server/database/errors";
import { recordAudit } from "@/server/audit/audit";
import { recordAcceptance } from "@/server/legal/acceptance";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { OWNER_ROLE_KEY } from "@/server/permissions/catalog";
import { canActOnMember, canGrantRole } from "@/server/permissions/evaluator";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseInput } from "@/lib/validation/parse";
import { createOrganizationSchema, updateOrganizationSchema, updateMemberSchema } from "@/lib/validation/organization";
import { loadAssignableRole } from "./roles";
import { assertAdminSeat, assertMemberSeat, assertWritable, occupiesAdminSeat, startTrial } from "@/server/billing/license";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  roleName: string;
  /** Logo image URL for members, or null for none. */
  logoUrl: string | null;
}

/** Organizations the user is an active member of (used by the switcher). */
export async function listUserOrganizations(userId: string): Promise<OrganizationSummary[]> {
  if (!isUuid(userId)) return [];
  const rows = await getDb()<(Omit<OrganizationSummary, "logoUrl"> & { logoUpdatedAt: Date | null })[]>`
    select o.id, o.name, o.slug, r.name as "roleName", o.logo_updated_at as "logoUpdatedAt"
    from organization_member m
    join organization o on o.id = m.organization_id
    join role r on r.id = m.role_id
    where m.user_id = ${userId} and m.status = 'active' and o.status = 'active'
    order by m.joined_at asc`;
  return rows.map(({ logoUpdatedAt, ...o }) => ({ ...o, logoUrl: orgLogoUrl(o.id, logoUpdatedAt) }));
}

const ORG_SLUG_CONSTRAINT = "organization_slug_key";

/**
 * AT-01: the creator becomes Owner; organization + membership + audit are
 * written in one transaction so they are always consistent.
 */
/**
 * @param opts.recordTerms store, in the same transaction, that the creator agreed
 *   to the current Terms and Privacy Policy (callers check that first).
 */
export async function createOrganization(user: { id: string; emailVerified: boolean; emailUnproven?: boolean }, input: unknown, opts: { recordTerms?: boolean } = {}) {
  // An unproven email (signed up while confirmation emails couldn't be sent) is
  // still a confirmed login; a workspace of your own exposes no one else's data.
  if (!user.emailVerified && !user.emailUnproven) throw new ForbiddenError("Verify your email address before creating an organization.");
  const data = parseInput(createOrganizationSchema, input);
  await enforceRateLimit(`org-create:${user.id}`, { max: 10, windowSeconds: 3600 });

  try {
    return await transaction(async (tx) => {
      const [ownerRole] = await tx<{ id: string }[]>`select id from role where organization_id is null and key = ${OWNER_ROLE_KEY}`;
      if (!ownerRole) throw new Error("System roles are missing. Run `npm run db:seed`.");
      const [org] = await tx<{ id: string; name: string; slug: string }[]>`
        insert into organization (name, slug, timezone, currency, created_by_id)
        values (${data.name}, ${data.slug}, ${data.timezone}, ${data.currency}, ${user.id})
        returning id, name, slug`;
      await tx`insert into organization_member (organization_id, user_id, role_id) values (${org.id}, ${user.id}, ${ownerRole.id})`;
      await startTrial(tx, org.id);
      if (opts.recordTerms) await recordAcceptance(tx, { userId: user.id, organizationId: org.id, context: "workspace" });
      await recordAudit(tx, {
        organizationId: org.id, actorUserId: user.id, action: "organization.created",
        targetType: "organization", targetId: org.id, metadata: { name: org.name, slug: org.slug },
      });
      return org;
    });
  } catch (e) {
    if (isUniqueViolation(e, ORG_SLUG_CONSTRAINT)) throw new ConflictError("That organization URL is already taken.");
    throw e;
  }
}

interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  status: "active" | "suspended" | "archived";
  createdAt: Date;
}

async function selectOrganization(q: Db, id: string, lock = false): Promise<OrganizationRecord | undefined> {
  const [org] = await q<OrganizationRecord[]>`
    select id, name, slug, timezone, trim(currency) as currency, status, created_at as "createdAt"
    from organization where id = ${id} ${lock ? q`for update` : q``}`;
  return org;
}

export async function getOrganization(ctx: OrgContext) {
  assertPermission(ctx, "organization.read");
  const org = await selectOrganization(getDb(), ctx.organizationId);
  if (!org) throw new NotFoundError();
  return org;
}

export async function updateOrganization(ctx: OrgContext, input: unknown) {
  assertPermission(ctx, "organization.update");
  const data = parseInput(updateOrganizationSchema, input);
  try {
    return await transaction(async (tx) => {
      const before = await selectOrganization(tx, ctx.organizationId, true);
      if (!before) throw new NotFoundError();
      await assertWritable(tx, ctx.organizationId);
      const [org] = await tx<{ id: string; name: string; slug: string; timezone: string; currency: string }[]>`
        update organization set
          name = ${data.name ?? before.name},
          slug = ${data.slug ?? before.slug},
          timezone = ${data.timezone ?? before.timezone},
          currency = ${data.currency ?? before.currency},
          updated_at = now()
        where id = ${ctx.organizationId}
        returning id, name, slug, timezone, trim(currency) as currency`;
      const fields = ["name", "slug", "timezone", "currency"] as const;
      const changed = Object.fromEntries(
        fields.filter((k) => data[k] !== undefined && before[k] !== org[k]).map((k) => [k, { from: before[k], to: org[k] }]),
      );
      await recordAudit(tx, {
        organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "organization.updated",
        targetType: "organization", targetId: ctx.organizationId, metadata: changed,
      });
      return org;
    });
  } catch (e) {
    if (isUniqueViolation(e, ORG_SLUG_CONSTRAINT)) throw new ConflictError("That organization URL is already taken.");
    throw e;
  }
}

// ───────────────────────────── Members ─────────────────────────────

export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  joinedAt: Date;
  role: { id: string; name: string; key: string; isSystem: boolean };
  avatarUrl: string | null;
}

export async function listMembers(ctx: OrgContext, opts: { query?: string; status?: "active" | "suspended" } = {}): Promise<MemberRow[]> {
  assertPermission(ctx, "organization.members.read");
  const sql = getDb();
  const q = opts.query?.trim();
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const rows = await sql<{
    id: string; user_id: string; status: "active" | "suspended"; joined_at: Date; name: string; email: string;
    role_id: string; role_name: string; role_key: string; is_system: boolean; avatar_updated_at: Date | null;
  }[]>`
    select m.id, m.user_id, m.status, m.joined_at, p.name, p.email, p.avatar_updated_at,
           r.id as role_id, r.name as role_name, r.key as role_key, r.is_system
    from organization_member m
    join profile p on p.id = m.user_id
    join role r on r.id = m.role_id
    where m.organization_id = ${ctx.organizationId}
      ${opts.status ? sql`and m.status = ${opts.status}` : sql``}
      ${like ? sql`and (p.name ilike ${like} or p.email ilike ${like})` : sql``}
    order by m.joined_at asc
    limit 500`;
  return rows.map((r) => ({
    id: r.id, userId: r.user_id, name: r.name, email: r.email, status: r.status, joinedAt: r.joined_at,
    role: { id: r.role_id, name: r.role_name, key: r.role_key, isSystem: r.is_system },
    avatarUrl: avatarUrl(r.user_id, r.avatar_updated_at),
  }));
}

/** Serialise membership changes per organization (protects the last-owner invariant). */
async function lockOrganization(tx: Db, organizationId: string) {
  await tx`select 1 from organization where id = ${organizationId} for update`;
}

async function countActiveOwners(tx: Db, organizationId: string): Promise<number> {
  const [{ n }] = await tx<{ n: number }[]>`
    select count(*)::int as n
    from organization_member m join role r on r.id = m.role_id
    where m.organization_id = ${organizationId} and m.status = 'active'
      and r.organization_id is null and r.key = ${OWNER_ROLE_KEY}`;
  return n;
}

async function loadTargetMember(tx: Db, ctx: OrgContext, memberId: string) {
  if (!isUuid(memberId)) throw new NotFoundError("Member not found");
  const [member] = await tx<{ id: string; userId: string; status: "active" | "suspended"; roleId: string }[]>`
    select id, user_id as "userId", status, role_id as "roleId"
    from organization_member where id = ${memberId} and organization_id = ${ctx.organizationId}`;
  if (!member) throw new NotFoundError("Member not found");
  const role = await loadAssignableRole(tx, ctx.organizationId, member.roleId);
  return { ...member, role };
}

export async function updateMember(ctx: OrgContext, memberId: string, input: unknown): Promise<void> {
  assertPermission(ctx, "organization.members.manage");
  const data = parseInput(updateMemberSchema, input);

  await transaction(async (tx) => {
    await lockOrganization(tx, ctx.organizationId);
    const target = await loadTargetMember(tx, ctx, memberId);
    const check = canActOnMember(ctx, { memberId: target.id, role: target.role });
    if (!check.allowed) throw new ForbiddenError(check.reason);
    const targetIsOwner = target.role.isSystem && target.role.key === OWNER_ROLE_KEY;

    if (data.roleId && data.roleId !== target.roleId) {
      const newRole = await loadAssignableRole(tx, ctx.organizationId, data.roleId);
      const grant = canGrantRole(ctx, newRole);
      if (!grant.allowed) throw new ForbiddenError(grant.reason);
      const license = await assertWritable(tx, ctx.organizationId);
      const takesSeat = (data.status ?? target.status) === "active";
      if (takesSeat && occupiesAdminSeat(newRole) && !occupiesAdminSeat(target.role)) {
        await assertAdminSeat(tx, ctx.organizationId, license);
      }
      if (targetIsOwner && target.status === "active" && (await countActiveOwners(tx, ctx.organizationId)) <= 1) {
        throw new ConflictError("An organization must keep at least one active owner.");
      }
      await tx`update organization_member set role_id = ${newRole.id}, updated_at = now() where id = ${target.id}`;
      await recordAudit(tx, {
        organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.role_changed",
        targetType: "member", targetId: target.id,
        metadata: { userId: target.userId, fromRole: target.role.name, toRole: newRole.name },
      });
    }

    if (data.status && data.status !== target.status) {
      if (data.status === "active") {
        // Reactivating takes a seat again (and an admin seat for Owner/Admin roles).
        const license = await assertWritable(tx, ctx.organizationId);
        await assertMemberSeat(tx, ctx.organizationId, license);
        const [current] = await tx<{ key: string; is_system: boolean }[]>`
          select r.key, r.is_system from organization_member m join role r on r.id = m.role_id where m.id = ${target.id}`;
        if (current && occupiesAdminSeat({ key: current.key, isSystem: current.is_system })) {
          await assertAdminSeat(tx, ctx.organizationId, license);
        }
      }
      if (data.status === "suspended" && targetIsOwner && (await countActiveOwners(tx, ctx.organizationId)) <= 1) {
        throw new ConflictError("An organization must keep at least one active owner.");
      }
      await tx`update organization_member set status = ${data.status}, updated_at = now() where id = ${target.id}`;
      await recordAudit(tx, {
        organizationId: ctx.organizationId, actorUserId: ctx.userId,
        action: data.status === "suspended" ? "member.suspended" : "member.reactivated",
        targetType: "member", targetId: target.id, metadata: { userId: target.userId },
      });
    }
  });
}

export async function removeMember(ctx: OrgContext, memberId: string): Promise<void> {
  assertPermission(ctx, "organization.members.remove");
  await transaction(async (tx) => {
    await lockOrganization(tx, ctx.organizationId);
    const target = await loadTargetMember(tx, ctx, memberId);
    const check = canActOnMember(ctx, { memberId: target.id, role: target.role });
    if (!check.allowed) throw new ForbiddenError(check.reason);
    const targetIsOwner = target.role.isSystem && target.role.key === OWNER_ROLE_KEY;
    if (targetIsOwner && target.status === "active" && (await countActiveOwners(tx, ctx.organizationId)) <= 1) {
      throw new ConflictError("An organization must keep at least one active owner.");
    }
    await tx`delete from organization_member where id = ${target.id}`;
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.removed",
      targetType: "member", targetId: target.id, metadata: { userId: target.userId, role: target.role.name },
    });
  });
}

export async function leaveOrganization(ctx: OrgContext): Promise<void> {
  await transaction(async (tx) => {
    await lockOrganization(tx, ctx.organizationId);
    if (ctx.isOwner && (await countActiveOwners(tx, ctx.organizationId)) <= 1) {
      throw new ConflictError("Transfer ownership to another member before leaving.");
    }
    await tx`delete from organization_member where id = ${ctx.memberId}`;
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.left",
      targetType: "member", targetId: ctx.memberId,
    });
  });
}
