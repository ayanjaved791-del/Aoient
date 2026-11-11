import type { MetadataRoute } from "next";
import { resolveAppUrl } from "@/lib/app-url";

/** The public marketing pages only. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveAppUrl();
  return [
    { path: "", priority: 1 }, { path: "/features", priority: 0.9 }, { path: "/modules", priority: 0.9 }, { path: "/pricing", priority: 0.9 },
    { path: "/security", priority: 0.7 }, { path: "/faq", priority: 0.7 }, { path: "/download", priority: 0.6 }, { path: "/sign-up", priority: 0.6 },
    { path: "/terms", priority: 0.3 }, { path: "/privacy", priority: 0.3 },
  ].map((p) => ({ url: `${base}${p.path}`, changeFrequency: "weekly", priority: p.priority }));
}
