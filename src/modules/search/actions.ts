"use server";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { searchWorkspace } from "@/server/search/search";

/** Ctrl+K search. The workspace is re-verified from the slug on every call. */
export async function searchWorkspaceAction(slug: string, query: string) {
  return runAction(async () => {
    const user = await requireUser();
    const ctx = await resolveOrgContext(user.id, { slug: String(slug) });
    await enforceRateLimit(`search:${user.id}`, { max: 240, windowSeconds: 300 });
    return searchWorkspace(ctx, String(query ?? ""));
  });
}
