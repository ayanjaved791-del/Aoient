import { ok, withOrg } from "@/server/api/http";
import { revokeInvitation } from "@/server/organizations/invitations";

export const DELETE = withOrg<{ id: string; invitationId: string }>(async ({ ctx, params }) => {
  await revokeInvitation(ctx, params.invitationId);
  return ok({ id: params.invitationId });
});
