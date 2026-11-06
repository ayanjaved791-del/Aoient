"use server";
/**
 * Server actions for organization administration. Each one re-authenticates,
 * re-resolves the tenant from the slug (never trusting an id from the client),
 * delegates to the domain service, then refreshes the client router.
 */
import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import { createOrganization, leaveOrganization, removeMember, updateMember, updateOrganization } from "@/server/organizations/organizations";
import { acceptInvitation, createInvitation, revokeInvitation } from "@/server/organizations/invitations";
import { createCustomRole, deleteCustomRole, updateCustomRole } from "@/server/organizations/roles";

async function ctxFor(slug: string) {
  const user = await requireUser();
  return resolveOrgContext(user.id, { slug: String(slug) });
}

export async function createOrganizationAction(input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    const org = await createOrganization(user, input);
    return { slug: org.slug };
  });
}

export async function updateOrganizationAction(slug: string, input: unknown) {
  return runAction(async () => {
    const org = await updateOrganization(await ctxFor(slug), input);
    refresh();
    return { slug: org.slug };
  });
}

export async function inviteMemberAction(slug: string, input: unknown) {
  return runAction(async () => {
    const result = await createInvitation(await ctxFor(slug), input);
    refresh();
    return result;
  });
}

export async function revokeInvitationAction(slug: string, invitationId: string) {
  return runAction(async () => {
    await revokeInvitation(await ctxFor(slug), String(invitationId));
    refresh();
  });
}

export async function updateMemberAction(slug: string, memberId: string, input: unknown) {
  return runAction(async () => {
    await updateMember(await ctxFor(slug), String(memberId), input);
    refresh();
  });
}

export async function removeMemberAction(slug: string, memberId: string) {
  return runAction(async () => {
    await removeMember(await ctxFor(slug), String(memberId));
    refresh();
  });
}

export async function leaveOrganizationAction(slug: string) {
  return runAction(async () => {
    await leaveOrganization(await ctxFor(slug));
  });
}

export async function createRoleAction(slug: string, input: unknown) {
  return runAction(async () => {
    const r = await createCustomRole(await ctxFor(slug), input);
    refresh();
    return r;
  });
}

export async function updateRoleAction(slug: string, roleId: string, input: unknown) {
  return runAction(async () => {
    await updateCustomRole(await ctxFor(slug), String(roleId), input);
    refresh();
  });
}

export async function deleteRoleAction(slug: string, roleId: string) {
  return runAction(async () => {
    await deleteCustomRole(await ctxFor(slug), String(roleId));
    refresh();
  });
}

export async function acceptInvitationAction(token: string) {
  return runAction(async () => {
    const user = await requireUser();
    return acceptInvitation(user, String(token));
  });
}
