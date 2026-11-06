import { ok, readJson, withOrg } from "@/server/api/http";
import { createInvitation, listPendingInvitations } from "@/server/organizations/invitations";

export const GET = withOrg(async ({ ctx }) => ok(await listPendingInvitations(ctx)));

export const POST = withOrg(async ({ req, ctx }) => ok(await createInvitation(ctx, await readJson(req)), { status: 201 }));
