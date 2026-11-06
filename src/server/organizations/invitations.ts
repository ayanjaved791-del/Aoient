import "server-only";
import { db } from "@/server/database/client";
import { isUniqueViolation } from "@/server/database/errors";
import { recordAudit } from "@/server/audit/audit";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { getEmailProvider } from "@/server/email/provider";
import { invitationMessage } from "@/server/email/templates";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { canGrantRole } from "@/server/permissions/evaluator";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { parseInput } from "@/lib/validation/parse";
import { createInvitationSchema } from "@/lib/validation/organization";
import { generateToken, hashToken } from "@/lib/tokens";
import { loadAssignableRole } from "./roles";

export const INVITATION_TTL_DAYS = 7;

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export interface InvitationRow {
  id: string;
  email: string;
  roleName: string;
  status: "pending" | "expired";
  expiresAt: Date;
  createdAt: Date;
  invitedByName: string | null;
}

export async function listPendingInvitations(ctx: OrgContext): Promise<InvitationRow[]> {
  assertPermission(ctx, "organization.members.read");
  const rows = await db.invitation.findMany({
    where: { organizationId: ctx.organizationId, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, expiresAt: true, createdAt: true, role: { select: { name: true } }, invitedBy: { select: { name: true } } },
  });
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    roleName: r.role.name,
    status: r.expiresAt.getTime() < now ? "expired" : "pending",
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    invitedByName: r.invitedBy?.name ?? null,
  }));
}

/**
 * Invitation lifecycle (spec §20): random 256-bit token → only its SHA-256 is
 * stored → email carries the raw token → acceptance validates hash + expiry +
 * recipient email → membership created → invitation marked accepted → audited.
 * Re-inviting an address revokes the previous pending invitation.
 */
export async function createInvitation(ctx: OrgContext, input: unknown): Promise<{ id: string; delivered: boolean }> {
  assertPermission(ctx, "organization.members.invite");
  const data = parseInput(createInvitationSchema, input);
  await enforceRateLimit(`invite:user:${ctx.userId}`, { max: 30, windowSeconds: 3600 });
  await enforceRateLimit(`invite:org:${ctx.organizationId}`, { max: 100, windowSeconds: 3600 });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { invitation, role, inviterName } = await db.$transaction(async (tx) => {
    const role = await loadAssignableRole(tx, ctx.organizationId, data.roleId);
    const grant = canGrantRole(ctx, role);
    if (!grant.allowed) throw new ForbiddenError(grant.reason);

    const existingMember = await tx.organizationMember.findFirst({
      where: { organizationId: ctx.organizationId, user: { email: { equals: data.email, mode: "insensitive" } } },
      select: { id: true },
    });
    if (existingMember) throw new ConflictError("This person is already a member of the organization.");

    await tx.invitation.updateMany({
      where: { organizationId: ctx.organizationId, email: { equals: data.email, mode: "insensitive" }, status: "pending" },
      data: { status: "revoked" },
    });

    const invitation = await tx.invitation.create({
      data: { organizationId: ctx.organizationId, email: data.email, roleId: role.id, tokenHash: hashToken(token), expiresAt, invitedById: ctx.userId },
      select: { id: true },
    });
    const inviter = await tx.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.invited",
      targetType: "invitation", targetId: invitation.id, metadata: { email: data.email, role: role.name },
    });
    return { invitation, role, inviterName: inviter?.name ?? "A teammate" };
  }).catch((e) => {
    if (isUniqueViolation(e)) throw new ConflictError("An invitation for this email was just created. Refresh and try again.");
    throw e;
  });

  // Sent after commit so a failed transaction never emails a dead link.
  const provider = getEmailProvider();
  await provider.send(
    invitationMessage({
      to: data.email,
      organizationName: ctx.organization.name,
      inviterName,
      roleName: role.name,
      url: `${appUrl()}/invite/${token}`,
      expiresAt,
    }),
  );
  return { id: invitation.id, delivered: provider.deliversExternally };
}

export async function revokeInvitation(ctx: OrgContext, invitationId: string): Promise<void> {
  assertPermission(ctx, "organization.members.invite");
  await db.$transaction(async (tx) => {
    const res = await tx.invitation.updateMany({
      where: { id: invitationId, organizationId: ctx.organizationId, status: "pending" },
      data: { status: "revoked" },
    });
    if (res.count === 0) throw new NotFoundError("Invitation not found");
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.invitation_revoked",
      targetType: "invitation", targetId: invitationId,
    });
  });
}

export type InvitationPreview =
  | { state: "valid"; organizationName: string; roleName: string; email: string; inviterName: string | null; expiresAt: Date }
  | { state: "invalid" };

/** Shown on the accept page. Any problem (unknown, used, revoked, expired) collapses to "invalid". */
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  if (!token || token.length > 100) return { state: "invalid" };
  const inv = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      status: true, expiresAt: true, email: true,
      organization: { select: { name: true, status: true } },
      role: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!inv || inv.status !== "pending" || inv.expiresAt < new Date() || inv.organization.status !== "active") {
    return { state: "invalid" };
  }
  return { state: "valid", organizationName: inv.organization.name, roleName: inv.role.name, email: inv.email, inviterName: inv.invitedBy?.name ?? null, expiresAt: inv.expiresAt };
}

export async function acceptInvitation(
  user: { id: string; email: string; emailVerified: boolean },
  token: string,
): Promise<{ organizationSlug: string }> {
  if (!user.emailVerified) throw new ForbiddenError("Verify your email address before accepting invitations.");
  await enforceRateLimit(`invite-accept:${user.id}`, { max: 20, windowSeconds: 3600 });
  const tokenHash = hashToken(token);

  return db.$transaction(async (tx) => {
    const inv = await tx.invitation.findUnique({
      where: { tokenHash },
      select: { id: true, organizationId: true, email: true, roleId: true, organization: { select: { slug: true, status: true } } },
    });
    if (!inv || inv.organization.status !== "active") throw new NotFoundError("This invitation is invalid or has expired.");
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenError("This invitation was sent to a different email address. Sign in with that address to accept it.");
    }

    // Atomic single-use claim: only one concurrent accept can flip pending → accepted.
    const claimed = await tx.invitation.updateMany({
      where: { id: inv.id, status: "pending", expiresAt: { gt: new Date() } },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    if (claimed.count === 0) throw new NotFoundError("This invitation is invalid or has expired.");

    const existing = await tx.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: inv.organizationId, userId: user.id } },
      select: { id: true },
    });
    if (existing) throw new ConflictError("You are already a member of this organization.");

    const member = await tx.organizationMember.create({
      data: { organizationId: inv.organizationId, userId: user.id, roleId: inv.roleId },
      select: { id: true },
    });
    await recordAudit(tx, {
      organizationId: inv.organizationId, actorUserId: user.id, action: "member.joined",
      targetType: "member", targetId: member.id, metadata: { invitationId: inv.id },
    });
    return { organizationSlug: inv.organization.slug };
  });
}
