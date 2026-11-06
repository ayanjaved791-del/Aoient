import { ok, readJson, withOrg } from "@/server/api/http";
import { createCustomRole, listRoles } from "@/server/organizations/roles";

export const GET = withOrg(async ({ ctx }) => ok(await listRoles(ctx)));

export const POST = withOrg(async ({ req, ctx }) => ok(await createCustomRole(ctx, await readJson(req)), { status: 201 }));
