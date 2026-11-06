"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getLocalSessionUser, isLocalAuth, localSignOut, type LocalUser } from "@/lib/local-auth";

const PENDING = "pending";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
// Snapshots must be stable between renders, so serialise to a string.
function snapshot(): string {
  try {
    return JSON.stringify(getLocalSessionUser());
  } catch {
    return "null";
  }
}

/**
 * Browser-only session for client pages. Returns `undefined` while loading and
 * redirects to sign-in when nobody is signed in.
 */
export function useLocalUser(): { user: LocalUser | undefined; signOut: () => void } {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribe, snapshot, () => PENDING);
  const user = useMemo(() => (raw === PENDING ? undefined : (JSON.parse(raw) as LocalUser | null)), [raw]);

  useEffect(() => {
    if (!isLocalAuth) router.replace("/organizations");
    else if (user === null) router.replace("/sign-in");
  }, [user, router]);

  return {
    user: user ?? undefined,
    signOut: () => {
      localSignOut();
      router.replace("/sign-in");
    },
  };
}
