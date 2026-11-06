import { ok, withOrg } from "@/server/api/http";
import { listMembers } from "@/server/organizations/organizations";

export const GET = withOrg(async ({ req, ctx }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const members = await listMembers(ctx, {
    query: url.searchParams.get("q") ?? undefined,
    status: status === "active" || status === "suspended" ? status : undefined,
  });
  return ok(members, { meta: { count: members.length } });
});
