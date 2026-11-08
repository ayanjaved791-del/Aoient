"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { networkServerSnapshot, networkSnapshot, reportNetworkFailure, startNetworkWatch, subscribeNetwork } from "./network-store";

const looksLikeNetworkError = (reason: unknown) =>
  reason instanceof TypeError && /fetch|network|load failed/i.test(reason.message);

/**
 * A bar at the bottom of the screen while the device can't reach Aoient, and a
 * quiet "back online" (with fresh data) when it can again. Also turns a failed
 * save caused by the connection into a clear message instead of nothing.
 */
export function NetworkStatus() {
  const router = useRouter();
  const state = useSyncExternalStore(subscribeNetwork, networkSnapshot, networkServerSnapshot);
  const wasDown = useRef(false);

  useEffect(() => {
    startNetworkWatch();
    const onRejection = (e: PromiseRejectionEvent) => {
      if (!looksLikeNetworkError(e.reason)) return;
      e.preventDefault();
      toast.error("Couldn't reach Aoient. Check your internet connection and try again.", { id: "network-error" });
      void reportNetworkFailure();
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  useEffect(() => {
    if (state !== "online") {
      wasDown.current = true;
      return;
    }
    if (wasDown.current) {
      wasDown.current = false;
      toast.success("You're back online.", { id: "network-back" });
      router.refresh();
    }
  }, [state, router]);

  if (state === "online") return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 sm:pb-4">
      <div className="flex max-w-xl items-start gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg ring-1 ring-white/10 dark:bg-neutral-100 dark:text-neutral-900 dark:ring-black/10">
        <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold">{state === "offline" ? "You're offline." : "Connected, but no internet."}</span>{" "}
          {state === "offline"
            ? "Check your Wi-Fi or mobile data. You can keep reading; changes won't save until you're back."
            : "Your Wi-Fi is on but Aoient can't be reached. We'll reconnect automatically."}
        </p>
      </div>
    </div>
  );
}
