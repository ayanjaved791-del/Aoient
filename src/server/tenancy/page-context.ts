import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/server/auth/session";
import { NotFoundError } from "@/lib/errors";
import { resolveOrgContext } from "./context";

/**
 * Page-level tenant resolution, memoised per request so the layout and page
 * share one membership lookup. Non-members get a plain 404 (no existence leak).
 */
export const getPageOrgContext = cache(async (slug: string) => {
  const user = await requireUserOrRedirect(`/${slug}`);
  try {
    const ctx = await resolveOrgContext(user.id, { slug });
    return { user, ctx };
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
});
