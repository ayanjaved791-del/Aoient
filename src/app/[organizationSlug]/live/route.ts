import { getSessionUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { buildVersion, getLiveFingerprint } from "@/server/live/fingerprint";
import { AppError } from "@/lib/errors";

/**
 * GET /{slug}/live → { v, build }. Polled quietly by open pages to know when to
 * refresh. Membership is verified on every call; non-members get 404.
 */
export async function GET(_req: Request, { params }: RouteContext<"/[organizationSlug]/live">) {
  const headers = { "cache-control": "no-store" };
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401, headers });
  const { organizationSlug } = await params;
  try {
    const ctx = await resolveOrgContext(user.id, { slug: organizationSlug });
    return Response.json({ v: await getLiveFingerprint(ctx), build: buildVersion() }, { headers });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: "not_found" }, { status: 404, headers });
    throw e;
  }
}
