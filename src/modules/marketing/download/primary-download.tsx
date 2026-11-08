"use client";
import { useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import type { DesktopAsset, DesktopAssetKey } from "@/server/desktop/releases";

type Os = "windows" | "mac" | "linux" | "phone" | "unknown";

function detectOs(): Os {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } };
  const ua = navigator.userAgent;
  if (nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "phone";
  const p = (nav.userAgentData?.platform || navigator.platform || ua).toLowerCase();
  if (p.includes("win")) return "windows";
  if (p.includes("mac")) return "mac";
  if (p.includes("linux") || p.includes("x11") || p.includes("cros")) return "linux";
  return "unknown";
}

const noSubscribe = () => () => {};

const btn = "group inline-flex h-12 items-center gap-2.5 rounded-lg bg-black px-6 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200";

/**
 * The big button in the hero: the installer for the visitor's computer. Until
 * the system is known (first paint) it points at the list of all downloads.
 */
export function PrimaryDownload({ assets }: { assets: Partial<Record<DesktopAssetKey, DesktopAsset>> }) {
  // "unknown" on the server and during hydration, the real system after.
  const os = useSyncExternalStore(noSubscribe, detectOs, () => "unknown" as Os);

  const pick: { label: string; asset?: DesktopAsset } =
    os === "windows" ? { label: "Download for Windows", asset: assets.windows }
    : os === "mac" ? { label: "Download for Mac", asset: assets.macArm ?? assets.macIntel }
    : os === "linux" ? { label: "Download for Linux", asset: assets.linuxAppImage ?? assets.linuxDeb }
    : { label: "" };

  if (os === "phone") {
    return <a href="#phone" className={btn}>Install on this phone</a>;
  }
  if (!pick.asset) {
    return <a href="#desktop" className={btn}><Download className="size-4" aria-hidden />Choose your download</a>;
  }
  return (
    <a href={pick.asset.url} className={btn}>
      <Download className="size-4" aria-hidden />{pick.label}
    </a>
  );
}
