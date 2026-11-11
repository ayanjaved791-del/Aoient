import type { MetadataRoute } from "next";
import { resolveAppUrl } from "@/lib/app-url";

/** Public pages may be indexed; workspaces, accounts and APIs never are. */
export default function robots(): MetadataRoute.Robots {
  const base = resolveAppUrl();
  return {
    rules: [{ userAgent: "*", allow: ["/", "/features", "/modules", "/security", "/pricing", "/faq", "/download", "/terms", "/privacy"], disallow: ["/api/", "/account", "/organizations", "/checkout", "/invite/", "/auth/", "/home"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
