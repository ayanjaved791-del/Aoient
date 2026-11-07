"use client";
import { useEffect } from "react";
import { startInstallListener } from "./install-store";

/** Registers the service worker (production only) and starts listening for the install prompt. */
export function PwaRegister() {
  useEffect(() => {
    startInstallListener();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the site works without it, only the offline page is lost.
    });
  }, []);
  return null;
}
