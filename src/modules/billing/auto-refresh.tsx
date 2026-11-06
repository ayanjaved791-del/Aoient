"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

let refreshes = 0;

/** Re-renders the server page every `everyMs`, at most `maxTimes` per page visit. */
export function AutoRefresh({ everyMs, maxTimes }: { everyMs: number; maxTimes: number }) {
  const router = useRouter();
  useEffect(() => {
    if (refreshes >= maxTimes) return;
    const t = setTimeout(() => {
      refreshes += 1;
      router.refresh();
    }, everyMs);
    return () => clearTimeout(t);
  }, [router, everyMs, maxTimes]);
  return null;
}
