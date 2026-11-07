"use client";
import { useSyncExternalStore } from "react";

/** Chrome/Edge/Samsung fire this when the app can be installed; Safari and Firefox never do. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState =
  /** Already running as the installed app. */
  | "installed"
  /** The browser offered an install prompt; one click installs. */
  | "available"
  /** iPhone/iPad Safari: install is manual (Share → Add to Home Screen). */
  | "ios"
  /** No prompt (yet). The browser menu may still offer it, or it isn't supported. */
  | "manual";

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: window-controls-overlay)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

let started = false;
/** Called once, early, so the prompt event isn't missed before any button mounts. */
export function startInstallListener() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own button instead of the browser's mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

function snapshot(): InstallState {
  if (installedNow || isStandalone()) return "installed";
  if (deferred) return "available";
  if (isIos()) return "ios";
  return "manual";
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    snapshot,
    () => "manual",
  );
}

/** Opens the browser's install dialog. Resolves true if the person accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null; // a prompt can only be used once
  emit();
  return outcome === "accepted";
}
