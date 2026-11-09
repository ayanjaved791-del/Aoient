import "server-only";
import { getDb, transaction } from "@/server/database/client";
import { isUuid } from "@/lib/ids";
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
import { resolveAppUrl } from "@/lib/app-url";
import { assertAdminSeat, assertMemberSeat, assertWritable, occupiesAdminSeat } from "@/server/billing/license";

export const INVITATION_TTL_DAYS = 7;

const appUrl = () => resolveAppUrl();

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
  const rows = await getDb()<{ id: string; email: string; expires_at: Date; created_at: Date; role_name: string; invited_by_name: string | null }[]>`
    select i.id, i.email, i.expires_at, i.created_at, r.name as role_name, p.name as invited_by_name
    from invitation i
    join role r on r.id = i.role_id
    left join profile p on p.id = i.invited_by_id
    where i.organization_id = ${ctx.organizationId} and i.status = 'pending'
    order by i.created_at desc`;
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    roleName: r.role_name,
    status: r.expires_at.getTime() < now ? "expired" : "pending",
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    invitedByName: r.invited_by_name,
  }));
}

/**
 * Invitation lifecycle (spec §20): random 256-bit token → only its SHA-256 is
 * stored → email carries the raw token → acceptance validates hash + expiry +
 * recipient email → membership created → invitation marked accepted → audited.
 * Re-inviting an address revokes the previous pending invitation.
 */
export interface CreatedInvitation {
  id: string;
  email: string;
  roleName: string;
  expiresAt: Date;
  /**
   * The join link. Returned once, to the inviter only, so they can share it
   * themselves; the database keeps just its hash. It works only for `email`.
   */
  url: string;
  /** Whether an email actually left the server. */
  delivered: boolean;
}

export async function createInvitation(ctx: OrgContext, input: unknown): Promise<CreatedInvitation> {
  assertPermission(ctx, "organization.members.invite");
  const data = parseInput(createInvitationSchema, input);
  await enforceRateLimit(`invite:user:${ctx.userId}`, { max: 30, windowSeconds: 3600 });
  await enforceRateLimit(`invite:org:${ctx.organizationId}`, { max: 100, windowSeconds: 3600 });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { invitation, role, inviterName } = await transaction(async (tx) => {
    // Serialise seat checks per organization so two invites can't both take the last seat.
    await tx`select 1 from organization where id = ${ctx.organizationId} for update`;
    const license = await assertWritable(tx, ctx.organizationId);
    const role = await loadAssignableRole(tx, ctx.organizationId, data.roleId);
    const grant = canGrantRole(ctx, role);
    if (!grant.allowed) throw new ForbiddenError(grant.reason);

    const [existingMember] = await tx`
      select 1 from organization_member m join profile p on p.id = m.user_id
      where m.organization_id = ${ctx.organizationId} and lower(p.email) = lower(${data.email})`;
    if (existingMember) throw new ConflictError("This person is already a member of the organization.");

    await tx`
      update invitation set status = 'revoked', updated_at = now()
      where organization_id = ${ctx.organizationId} and lower(email) = lower(${data.email}) and status = 'pending'`;

    await assertMemberSeat(tx, ctx.organizationId, license);
    if (occupiesAdminSeat(role)) await assertAdminSeat(tx, ctx.organizationId, license);

    const [invitation] = await tx<{ id: string }[]>`
      insert into invitation (organization_id, email, role_id, token_hash, expires_at, invited_by_id)
      values (${ctx.organizationId}, ${data.email}, ${role.id}, ${hashToken(token)}, ${expiresAt}, ${ctx.userId})
      returning id`;
    const [inviter] = await tx<{ name: string }[]>`select name from profile where id = ${ctx.userId}`;
    await recordAudit(tx, {
      organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "member.invited",
      targetType: "invitation", targetId: invitation.id, metadata: { email: data.email, role: role.name },
    });
    return { invitation, role, inviterName: inviter?.name || "A teammate" };
  }).catch((e) => {
    if (isUniqueViolation(e)) throw new ConflictError("An invitation for this email was just created. Refresh and try again.");
    throw e;
  });

  // Sent after commit so a failed transaction never emails a dead link. The
  // invitation stands even if sending fails: the inviter still gets the link.
  const url = `${appUrl()}/invite/${token}`;
  let delivered = false;
  try {
    const provider = getEmailProvider();
    await provider.send(invitationMessage({ to: data.email, organizationName: ctx.organization.name, inviterName, roleName: role.name, url, expiresAt }));
    delivered = provider.deliversExternally;
  } catch (e) {
    console.error("[invitations] email not sent", e instanceof Error ? e.message : e);
  }
  return { id: invitation.id, email: data.email, roleName: role.name, expiresAt, url, delivered };
}

/**
 * Only a hash of each link is stored, so an old link can't be shown again.
 * This issues a fresh link for a pending (or expired) invitation with the same
 * email and role, through the same checks as a new invite; the old link stops working.
 */
export async function renewInvitation(ctx: OrgContext, invitationId: string): Promise<CreatedInvitation> {
  assertPermission(ctx, "organization.members.invite");
  if (!isUuid(invitationId)) throw new NotFoundError("Invitation not found");
  const [inv] = await getDb()<{ email: string; role_id: string }[]>`
    select email, role_id from invitation
    where id = ${invitationId} and organization_id = ${ctx.organizationId} and status = 'pending'`;
  if (!inv) throw new NotFoundError("Invitation not found");
  return createInvitation(ctx, { email: inv.email, roleId: inv.role_id });
}

export async function revokeInvitation(ctx: OrgContext, invitationId: string): Promise<void> {
  assertPermission(ctx, "organization.members.invite");
  if (!isUuid(invitationId)) throw new NotFoundError("Invitation not found");
  await transaction(async (tx) => {
    const res = await tx`
      update invitation set status = 'revoked', updated_at = now()
      where id = ${invitationId} and organization_id = ${ctx.organizationId} and status = 'pending'`;
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
  const [inv] = await getDb()<{
    status: string; expires_at: Date; email: string; org_name: string; org_status: string; role_name: string; inviter_name: string | null;
  }[]>`
    select i.status, i.expires_at, i.email, o.name as org_name, o.status as org_status, r.name as role_name, p.name as inviter_name
    from invitation i
    join organization o on o.id = i.organization_id
    join role r on r.id = i.role_id
    left join profile p on p.id = i.invited_by_id
    where i.token_hash = ${hashToken(token)}`;
  if (!inv || inv.status !== "pending" || inv.expires_at < new Date() || inv.org_status !== "active") {
    return { state: "invalid" };
  }
  return { state: "valid", organizationName: inv.org_name, roleName: inv.role_name, email: inv.email, inviterName: inv.inviter_name, expiresAt: inv.expires_at };
}

type InvitationUser = { id: string; email: string; emailVerified: boolean; emailUnproven?: boolean };

export interface MyInvitation {
  id: string;
  organizationName: string;
  roleName: string;
  inviterName: string | null;
  expiresAt: Date;
}

/**
 * Open invitations addressed to the signed-in person's own verified email, so
 * someone who signed up without clicking their link still finds their team.
 * Nothing is shown for an unverified email: the address must be proven first.
 */
export async function listMyInvitations(user: InvitationUser): Promise<MyInvitation[]> {
  if (!user.emailVerified || !user.email) return [];
  const rows = await getDb()<{ id: string; org_name: string; role_name: string; inviter_name: string | null; expires_at: Date }[]>`
    select i.id, o.name as org_name, r.name as role_name, p.name as inviter_name, i.expires_at
    from invitation i
    join organization o on o.id = i.organization_id
    join role r on r.id = i.role_id
    left join profile p on p.id = i.invited_by_id
    where lower(i.email) = lower(${user.email})
      and i.status = 'pending' and i.expires_at > now() and o.status = 'active'
      and not exists (select 1 from organization_member m where m.organization_id = i.organization_id and m.user_id = ${user.id})
    order by i.created_at desc
    limit 20`;
  return rows.map((r) => ({ id: r.id, organizationName: r.org_name, roleName: r.role_name, inviterName: r.inviter_name, expiresAt: r.expires_at }));
}

/** Accepts an invitation from its join link. */
export async function acceptInvitation(user: InvitationUser, token: string): Promise<{ organizationSlug: string }> {
  return acceptWhere(user, { tokenHash: hashToken(String(token)) });
}

/**
 * Accepts one of the invitations listed by `listMyInvitations`. The id alone
 * proves nothing: the same email check as the link applies, so a guessed or
 * copied id for someone else's invitation is refused.
 */
export async function acceptMyInvitation(user: InvitationUser, invitationId: string): Promise<{ organizationSlug: string }> {
  if (!isUuid(invitationId)) throw new NotFoundError("This invitation is invalid or has expired.");
  return acceptWhere(user, { id: invitationId });
}

async function acceptWhere(
  user: InvitationUser,
  by: { tokenHash: string } | { id: string },
): Promise<{ organizationSlug: string }> {
  // The join link is a secret sent to the invitee, so it may be used by a login
  // whose email is unproven (still matched below). Finding invitations by email
  // alone (an id, no link) needs a proven inbox.
  const proven = user.emailVerified || ("tokenHash" in by && user.emailUnproven === true);
  if (!proven) throw new ForbiddenError("Verify your email address before accepting invitations.");
  await enforceRateLimit(`invite-accept:${user.id}`, { max: 20, windowSeconds: 3600 });

  return transaction(async (tx) => {
    const [inv] = await tx<{ id: string; organization_id: string; email: string; role_id: string; slug: string; org_status: string }[]>`
      select i.id, i.organization_id, i.email, i.role_id, o.slug, o.status as org_status
      from invitation i join organization o on o.id = i.organization_id
      where ${"tokenHash" in by ? tx`i.token_hash = ${by.tokenHash}` : tx`i.id = ${by.id}`}`;
    if (!inv || inv.org_status !== "active") throw new NotFoundError("This invitation is invalid or has expired.");
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
      // By id, someone else's invitation looks exactly like a missing one.
      if ("id" in by) throw new NotFoundError("This invitation is invalid or has expired.");
      throw new ForbiddenError("This invitation was sent to a different email address. Sign in with that address to accept it.");
    }
    // Atomic single-use claim: only one concurrent accept can flip pending → accepted.
    const claimed = await tx`
      update invitation set status = 'accepted', accepted_at = now(), updated_at = now()
      where id = ${inv.id} and status = 'pending' and expires_at > now()`;
    if (claimed.count === 0) throw new NotFoundError("This invitation is invalid or has expired.");

    // Plan limits at the moment of joining (the plan may have changed since the invite).
    await tx`select 1 from organization where id = ${inv.organization_id} for update`;
    const license = await assertWritable(tx, inv.organization_id);
    await assertMemberSeat(tx, inv.organization_id, license);
    const role = await loadAssignableRole(tx, inv.organization_id, inv.role_id);
    if (occupiesAdminSeat(role)) await assertAdminSeat(tx, inv.organization_id, license);

    const [existing] = await tx`select 1 from organization_member where organization_id = ${inv.organization_id} and user_id = ${user.id}`;
    if (existing) throw new ConflictError("You are already a member of this organization.");

    const [member] = await tx<{ id: string }[]>`
      insert into organization_member (organization_id, user_id, role_id)
      values (${inv.organization_id}, ${user.id}, ${inv.role_id}) returning id`;
    await recordAudit(tx, {
      organizationId: inv.organization_id, actorUserId: user.id, action: "member.joined",
      targetType: "member", targetId: member.id, metadata: { invitationId: inv.id },
    });
    return { organizationSlug: inv.slug };
  });
}
