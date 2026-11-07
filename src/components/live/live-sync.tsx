"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const INTERVAL_MS = 10_000;

/** True while the person is typing or has a dialog open, so we never yank the page from under them. */
function isBusy(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return true;
  return Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
}

/**
 * Keeps the workspace live without a manual refresh. Every few seconds (only
 * while the tab is visible, and right away when it comes back into view) it
 * asks the server for a fingerprint of the organization's data. When that
 * changes, the page re-renders with fresh server data, keeping what's on screen
 * (scroll, open menus, typed text). A new deployment reloads the tab once the
 * person isn't busy. Renders nothing.
 */
export function LiveSync({ slug }: { slug: string }) {
  const router = useRouter();
  const last = useRef<{ v: string; build: string } | null>(null);
  const pending = useRef<"refresh" | "reload" | null>(null);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;

    const apply = () => {
      if (!pending.current || isBusy()) return;
      const action = pending.current;
      pending.current = null;
      if (action === "reload") window.location.reload();
      else router.refresh();
    };

    const check = async () => {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const res = await fetch(`/${encodeURIComponent(slug)}/live`, { cache: "no-store", credentials: "same-origin" });
        if (res.status === 401 || res.status === 404) {
          // Signed out or removed from this workspace: let the server redirect.
          pending.current = "refresh";
        } else if (res.ok) {
          const next = (await res.json()) as { v: string; build: string };
          const prev = last.current;
          last.current = next;
          if (prev && prev.build !== next.build) pending.current = "reload";
          else if (prev && prev.v !== next.v && pending.current !== "reload") pending.current = "refresh";
        }
      } catch {
        // Offline or a hiccup: try again on the next tick.
      } finally {
        inFlight = false;
        apply();
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    const timer = window.setInterval(() => void check(), INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    void check();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [slug, router]);

  return null;
}
