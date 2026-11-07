import { ok, readJson, withUser } from "@/server/api/http";
import { createOrganization, listUserOrganizations } from "@/server/organizations/organizations";
import { assertTermsAccepted } from "@/server/legal/acceptance";

export const GET = withUser(async ({ user }) => ok(await listUserOrganizations(user.id)));

/** Body needs `acceptTerms: true` unless the user already agreed to the current Terms and Privacy Policy. */
export const POST = withUser(async ({ req, user }) => {
  const body = await readJson(req);
  await assertTermsAccepted(user.id, body);
  return ok(await createOrganization(user, body, { recordTerms: true }), { status: 201 });
});
