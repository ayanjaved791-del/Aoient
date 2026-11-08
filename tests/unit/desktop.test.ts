/** Desktop app: release file matching, the aoient:// return link and the callback hand-off. */
import { describe, expect, it, vi } from "vitest";
import { desktopReturnLink, isDesktopUserAgent } from "@/lib/desktop";
import { toDesktopRelease } from "@/server/desktop/releases";

vi.mock("next/cache", () => ({ cacheLife: () => undefined }));

const asset = (name: string, extra: Record<string, unknown> = {}) => ({
  name, size: 99_000_000, state: "uploaded",
  browser_download_url: `https://github.com/ayanjaved791-del/Aoient/releases/download/v1.0.0/${name}`, ...extra,
});
const release = (assets: ReturnType<typeof asset>[], extra: Record<string, unknown> = {}) => ({
  tag_name: "v1.0.0", html_url: "https://github.com/ayanjaved791-del/Aoient/releases/tag/v1.0.0",
  published_at: "2026-11-08T12:00:00Z", draft: false, prerelease: false, assets, ...extra,
});

describe("desktop releases", () => {
  it("maps each installer to its platform and ignores helper files", () => {
    const r = toDesktopRelease(release([
      asset("Aoient-1.0.0-win-x64.exe"), asset("Aoient-1.0.0-win-x64.exe.blockmap"), asset("latest.yml"),
      asset("Aoient-1.0.0-mac-arm64.dmg"), asset("Aoient-1.0.0-mac-x64.dmg"),
      asset("Aoient-1.0.0-linux-x86_64.AppImage"), asset("Aoient-1.0.0-linux-amd64.deb"), asset("latest-linux.yml"),
    ]));
    expect(r?.version).toBe("1.0.0");
    expect(Object.fromEntries(Object.entries(r!.assets).map(([k, v]) => [k, v!.name]))).toEqual({
      windows: "Aoient-1.0.0-win-x64.exe",
      macArm: "Aoient-1.0.0-mac-arm64.dmg",
      macIntel: "Aoient-1.0.0-mac-x64.dmg",
      linuxAppImage: "Aoient-1.0.0-linux-x86_64.AppImage",
      linuxDeb: "Aoient-1.0.0-linux-amd64.deb",
    });
  });

  it("shows nothing for drafts, pre-releases, releases without installers, or unfinished uploads", () => {
    expect(toDesktopRelease(release([asset("Aoient-1.0.0-win-x64.exe")], { draft: true }))).toBeNull();
    expect(toDesktopRelease(release([asset("Aoient-1.0.0-win-x64.exe")], { prerelease: true }))).toBeNull();
    expect(toDesktopRelease(release([asset("notes.txt")]))).toBeNull();
    expect(toDesktopRelease(release([asset("Aoient-1.0.0-win-x64.exe", { state: "new" })]))).toBeNull();
  });

  it("only links to files hosted on github.com", () => {
    const r = toDesktopRelease(release([asset("Aoient-1.0.0-win-x64.exe", { browser_download_url: "https://evil.example/Aoient-1.0.0-win-x64.exe" })]));
    expect(r).toBeNull();
  });
});

describe("desktop sign-in hand-off", () => {
  it("recognises the desktop app by its browser name", () => {
    expect(isDesktopUserAgent("Mozilla/5.0 Chrome/140 Safari/537.36 AoientDesktop/1.0.0")).toBe(true);
    expect(isDesktopUserAgent("Mozilla/5.0 Chrome/140 Safari/537.36")).toBe(false);
    expect(isDesktopUserAgent(null)).toBe(false);
  });

  it("builds the aoient:// link with a safe next path", () => {
    expect(desktopReturnLink("abc-123_DEF.456", "/acme/people")).toBe("aoient://auth/callback?code=abc-123_DEF.456&next=%2Facme%2Fpeople");
    expect(desktopReturnLink("abc-123_DEF.456", "//evil.example")).toBe("aoient://auth/callback?code=abc-123_DEF.456&next=%2Forganizations");
    expect(desktopReturnLink("abc-123_DEF.456", "https://evil.example")).toContain("next=%2Forganizations");
  });

  it("refuses anything that isn't a sign-in code", () => {
    expect(desktopReturnLink(null, "/")).toBeNull();
    expect(desktopReturnLink("short", "/")).toBeNull();
    expect(desktopReturnLink("abc&next=//evil", "/")).toBeNull();
    expect(desktopReturnLink("javascript:alert(1)", "/")).toBeNull();
  });
});
