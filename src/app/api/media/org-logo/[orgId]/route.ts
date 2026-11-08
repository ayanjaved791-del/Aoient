import { getSessionUser } from "@/server/auth/session";
import { getOrganizationLogo } from "@/server/media/media";
import { imageResponse } from "@/server/media/respond";

/** GET an organization's logo. Members only; everyone else gets 404. */
export async function GET(_req: Request, { params }: RouteContext<"/api/media/org-logo/[orgId]">) {
  const user = await getSessionUser();
  if (!user) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const { orgId } = await params;
  return imageResponse(() => getOrganizationLogo(user.id, orgId));
}
