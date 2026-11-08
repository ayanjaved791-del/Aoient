import { getSessionUser } from "@/server/auth/session";
import { getAvatar } from "@/server/media/media";
import { imageResponse } from "@/server/media/respond";

/** GET a profile picture. Yours, or someone's you share a workspace with; otherwise 404. */
export async function GET(_req: Request, { params }: RouteContext<"/api/media/avatar/[userId]">) {
  const user = await getSessionUser();
  if (!user) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const { userId } = await params;
  return imageResponse(() => getAvatar(user.id, userId));
}
