import { ok, readJson, withOrg } from "@/server/api/http";
import { deleteCustomRole, updateCustomRole } from "@/server/organizations/roles";

export const PATCH = withOrg<{ id: string; roleId: string }>(async ({ req, ctx, params }) => {
  await updateCustomRole(ctx, params.roleId, await readJson(req));
  return ok({ id: params.roleId });
});

export const DELETE = withOrg<{ id: string; roleId: string }>(async ({ ctx, params }) => {
  await deleteCustomRole(ctx, params.roleId);
  return ok({ id: params.roleId });
});
