import { ok, readJson, withOrg } from "@/server/api/http";
import { getOrganization, updateOrganization } from "@/server/organizations/organizations";

export const GET = withOrg(async ({ ctx }) => ok(await getOrganization(ctx)));

export const PATCH = withOrg(async ({ req, ctx }) => ok(await updateOrganization(ctx, await readJson(req))));
