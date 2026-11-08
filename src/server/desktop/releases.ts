import "server-only";
import { cacheLife } from "next/cache";

/**
 * Desktop installers are built by GitHub Actions (.github/workflows/desktop.yml)
 * and published as GitHub Releases. The download page lists exactly the files
 * the newest release contains, so a button only appears for a file that exists.
 */

export type DesktopAssetKey = "windows" | "macArm" | "macIntel" | "linuxAppImage" | "linuxDeb";

export interface DesktopAsset {
  name: string;
  url: string;
  size: number;
}

export interface DesktopRelease {
  version: string;
  publishedAt: string;
  pageUrl: string;
  assets: Partial<Record<DesktopAssetKey, DesktopAsset>>;
}

const MATCHERS: [DesktopAssetKey, RegExp][] = [
  ["windows", /-win-[\w]+\.exe$/i],
  ["macArm", /-mac-arm64\.dmg$/i],
  ["macIntel", /-mac-x64\.dmg$/i],
  ["linuxAppImage", /\.AppImage$/i],
  ["linuxDeb", /\.deb$/i],
];

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string; size: number; state?: string }[];
}

/** Picks installer files out of a GitHub release. Exported for tests. */
export function toDesktopRelease(r: GitHubRelease): DesktopRelease | null {
  if (r.draft || r.prerelease) return null;
  const assets: DesktopRelease["assets"] = {};
  for (const a of r.assets) {
    if (a.state && a.state !== "uploaded") continue;
    if (!a.browser_download_url.startsWith("https://github.com/")) continue;
    const hit = MATCHERS.find(([, re]) => re.test(a.name));
    if (hit && !assets[hit[0]]) assets[hit[0]] = { name: a.name, url: a.browser_download_url, size: a.size };
  }
  if (Object.keys(assets).length === 0) return null;
  return { version: r.tag_name.replace(/^v/, ""), publishedAt: r.published_at ?? "", pageUrl: r.html_url, assets };
}

export function desktopReleasesRepo(): string {
  const repo = process.env.DESKTOP_RELEASES_REPO?.trim() || "ayanjaved791-del/Aoient";
  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : "ayanjaved791-del/Aoient";
}

/** The newest published release that has desktop installers, or null if none yet. */
export async function getDesktopRelease(): Promise<DesktopRelease | null> {
  "use cache";
  cacheLife("minutes");
  try {
    const res = await fetch(`https://api.github.com/repos/${desktopReleasesRepo()}/releases?per_page=10`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "aoient-download-page" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const list = (await res.json()) as GitHubRelease[];
    for (const r of list) {
      const rel = toDesktopRelease(r);
      if (rel) return rel;
    }
    return null;
  } catch {
    return null;
  }
}
