import { ok, readJson, withOrg } from "@/server/api/http";
import { removeMember, updateMember } from "@/server/organizations/organizations";

export const PATCH = withOrg<{ id: string; memberId: string }>(async ({ req, ctx, params }) => {
  await updateMember(ctx, params.memberId, await readJson(req));
  return ok({ id: params.memberId });
});

export const DELETE = withOrg<{ id: string; memberId: string }>(async ({ ctx, params }) => {
  await removeMember(ctx, params.memberId);
  return ok({ id: params.memberId });
});
