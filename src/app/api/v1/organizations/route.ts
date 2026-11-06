import { ok, readJson, withUser } from "@/server/api/http";
import { createOrganization, listUserOrganizations } from "@/server/organizations/organizations";

export const GET = withUser(async ({ user }) => ok(await listUserOrganizations(user.id)));

export const POST = withUser(async ({ req, user }) => ok(await createOrganization(user, await readJson(req)), { status: 201 }));
