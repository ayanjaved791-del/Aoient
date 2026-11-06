import "server-only";
import { db, type Tx } from "@/server/database/client";
import { isUniqueViolation } from "@/server/database/errors";
import { recordAudit } from "@/server/audit/audit";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { OWNER_ROLE_KEY } from "@/server/permissions/catalog";
import { canActOnMember, canGrantRole } from "@/server/permissions/evaluator";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { parseInput } from "@/lib/validation/parse";
import { createOrganizationSchema, updateOrganizationSchema, updateMemberSchema } from "@/lib/validation/organization";
import { loadAssignableRole } from "./roles";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  roleName: string;
}

/** Organizations the user is an active member of (used by the switcher). */
export async function listUserOrganizations(userId: string): Promise<OrganizationSummary[]> {
  const rows = await db.organizationMember.findMany({
    where: { userId, status: "active", organization: { status: "active" } },
    orderBy: { joinedAt: "asc" },
    select: { organization: { select: { id: true, name: true, slug: true } }, role: { select: { name: true } } },
  });
  return rows.map((r) => ({ ...r.organization, roleName: r.role.name }));
}

/**
 * AT-01: the creator becomes Owner; organization + membership + audit are
 * written in one transaction so they are always consistent.
 */
export async function createOrganization(user: { id: string; emailVerified: boolean }, input: unknown) {
  if (!user.emailVerified) throw new ForbiddenError("Verify your email address before creating an organization.");
  const data = parseInput(createOrganizationSchema, input);
  await enforceRateLimit(`org-create:${user.id}`, { max: 10, windowSeconds: 3600 });

  try {
    return await db.$transaction(async (tx) => {
      const ownerRole = await tx.role.findFirst({ where: { organizationId: null, key: OWNER_ROLE_KEY }, select: { id: true } });
      if (!ownerRole) throw new Error("System roles are missing. Run `npm run db:seed`.");
      const org = await tx.organization.create({
        data: { name: data.name, slug: data.slug, timezone: data.timezone, currency: data.currency, createdById: user.id },
        select: { id: true, name: true, slug: true },
      });
      await tx.organizationMember.create({ data: { organizationId: org.id, userId: user.id, roleId: ownerRole.id } });
      await recordAudit(tx, {
        organizationId: org.id, actorUserId: user.id, action: "organization.created",
        targetType: "organization", targetId: org.id, metadata: { name: org.name, slug: org.slug },
      });
      return org;
    });
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new ConflictError("That organization URL is already taken.");
    throw e;
  }
}

export async function getOrganization(ctx: OrgContext) {
  assertPermission(ctx, "organization.read");
  const org = await db.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { id: true, name: true, slug: true, timezone: true, currency: true, status: true, createdAt: true },
  });
  if (!org) throw new NotFoundError();
  return org;
}

export async function updateOrganization(ctx: OrgContext, input: unknown) {
  assertPermission(ctx, "organization.update");
  const data = parseInput(updateOrganizationSchema, input);
  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
      const org = await tx.organization.update({
        where: { id: ctx.organizationId },
        data,
        select: { id: true, name: true, slug: true, timezone: true, currency: true },
      });
      const changed = Object.fromEntries(
        Object.keys(data).filter((k) => before[k as keyof typeof before] !== org[k as keyof typeof org])
          .map((k) => [k, { from: before[k as keyof typeof before], to: org[k as keyof typeof org] }]),
      );
      await recordAudit(tx, {
        organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "organization.updated",
        targetType: "organization", targetId: ctx.organizationId, metadata: changed,
      });
      return org;
    });
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new ConflictError("That organization URL is already taken.");
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
}

export async function listMembers(ctx: OrgContext, opts: { query?: string; status?: "active" | "suspended" } = {}): Promise<MemberRow[]> {
  assertPermission(ctx, "organization.members.read");
  const q = opts.query?.trim();
  const rows = await db.organizationMember.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(q ? { user: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } : {}),
    },
    orderBy: { joinedAt: "asc" },
    take: 500,
    select: {
      id: true, userId: true, status: true, joinedAt: true,
      user: { select: { name: true, email: true } },
      role: { select: { id: true, name: true, key: true, isSystem: true } },
    },
  });
  return rows.map((r) => ({ id: r.id, userId: r.userId, name: r.user.name, email: r.user.email, status: r.status, joinedAt: r.joinedAt, role: r.role }));
}

/** Serialise membership changes per organization (protects the last-owner invariant). */
async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.$executeRaw`SELECT 1 FROM "organization" WHERE "id" = ${organizationId} FOR UPDATE`;
}

async function countActiveOwners(tx: Tx, organizationId: string) {
  return tx.organizationMember.count({
    where: { organizationId, status: "active", role: { organizationId: null, key: OWNER_ROLE_KEY } },
  });
}

async function loadTargetMember(tx: Tx, ctx: OrgContext, memberId: string) {
  const member = await tx.organizationMember.findFirst({
    where: { id: memberId, organizationId: ctx.organizationId },
    select: { id: true, userId: true, status: true, roleId: true },
  });
  if (!member) throw new NotFoundError("Member not found");
  const role = await loadAssignableRole(tx, ctx.organizationId, member.roleId);
  return { ...member, role };
}

export async function updateMember(ctx: OrgContext, memberId: string, input: unknown): Promise<void> {
  assertPermission(ctx, "organization.members.manage");
  const data = parseInput(updateMemberSchema, input);

  await db.$transaction(async (tx) => {
    await lockOrganization(tx, ctx.organizationId);
    const target = await loadTargetMember(tx, ctx, memberId);
    const check = canActOnMember(ctx, { memberId: target.id, role: target.role });
    if (!check.allowed) throw new ForbiddenError(check.reason);
    const targetIsOwner = target.role.isSystem && target.role.key === OWNER_ROLE_KEY;

    if (data.roleId && data.roleId !== target.roleId) {
      const newRole = await loadAssignableRole(tx, ctx.organizationId, data.roleId);
      const grant = canGrantRole(ctx, newRole);
      if (!grant.allowed) throw new ForbiddenError(grant.reason);
      if (targetIsOwner && target.status === "active" && (await countActiveOwners(tx, ctx.organizationId)) <= 1) {
        throw new ConflictError("An organization must keep at least one active owner.");
      }
      await tx.organizationMember.update({ where: { id: target.id }, data: { roleId: newRole.id } });
      await recordAudit(tx, {
        organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.role_changed",
        targetType: "member", targetId: target.id,
        metadata: { userId: target.userId, fromRole: target.role.name, toRole: newRole.name },
      });
    }

    if (data.status && data.status !== target.status) {
      if (data.status === "suspended" && targetIsOwner && (await countActiveOwners(tx, ctx.organizationId)) <= 1) {
        throw new ConflictError("An organization must keep at least one active owner.");
      }
      await tx.organizationMember.update({ where: { id: target.id }, data: { status: data.status } });
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
  await db.$transaction(async (tx) => {
    await lockOrganization(tx, ctx.organizationId);
    const target = await loadTargetMember(tx, ctx, memberId);
    const check = canActOnMember(ctx, { memberId: target.id, role: target.role });
    if (!check.allowed) throw new ForbiddenError(check.reason);
    const targetIsOwner = target.role.isSystem && target.role.key === OWNER_ROLE_KEY;
    if (targetIsOwner && target.status === "active" && (await countActiveOwners(tx, ctx.organizationId)) <= 1) {
      throw new ConflictError("An organization must keep at least one active owner.");
    }
    await tx.organizationMember.delete({ where: { id: target.id } });
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.removed",
      targetType: "member", targetId: target.id, metadata: { userId: target.userId, role: target.role.name },
    });
  });
}

export async function leaveOrganization(ctx: OrgContext): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockOrganization(tx, ctx.organizationId);
    if (ctx.isOwner && (await countActiveOwners(tx, ctx.organizationId)) <= 1) {
      throw new ConflictError("Transfer ownership to another member before leaving.");
    }
    await tx.organizationMember.delete({ where: { id: ctx.memberId } });
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.left",
      targetType: "member", targetId: ctx.memberId,
    });
  });
}
