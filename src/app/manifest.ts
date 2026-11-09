import type { MetadataRoute } from "next";

/** Makes Aoient installable as an app (desktop and phone) from the browser. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Aoient — Business OS",
    short_name: "Aoient",
    description: "Your company's workspace: team, roles, billing and more in one place.",
    start_url: "/organizations?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My workspaces", short_name: "Workspaces", url: "/organizations?source=pwa-shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Plans & pricing", short_name: "Pricing", url: "/pricing?source=pwa-shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
