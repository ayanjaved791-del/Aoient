"use client";
/**
 * One shared answer to "can this device reach Aoient right now?".
 *
 * The browser's own online/offline flag only knows whether Wi-Fi or a cable is
 * connected. When a request fails while the flag still says "online" (Wi-Fi
 * without internet, captive portals, a dropped router), we ping our server to
 * find out, and keep checking until it answers again.
 */
export type NetworkState = "online" | "offline" | "no-internet";

let state: NetworkState = "online";
let started = false;
let probeTimer: number | null = null;
let probing = false;
const listeners = new Set<() => void>();

function set(next: NetworkState) {
  if (state === next) return;
  state = next;
  listeners.forEach((l) => l());
}

async function ping(): Promise<boolean> {
  try {
    const res = await fetch("/api/ping", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

function stopProbing() {
  if (probeTimer !== null) window.clearInterval(probeTimer);
  probeTimer = null;
}

/** Keep pinging every few seconds until the server answers. */
function startProbing() {
  if (probeTimer !== null) return;
  probeTimer = window.setInterval(async () => {
    if (!navigator.onLine) return;
    if (await ping()) {
      stopProbing();
      set("online");
    }
  }, 5000);
}

/** Call when a request to Aoient failed: checks whether the internet is the reason. */
export async function reportNetworkFailure(): Promise<void> {
  if (typeof window === "undefined" || probing) return;
  if (!navigator.onLine) {
    set("offline");
    return;
  }
  probing = true;
  const ok = await ping();
  probing = false;
  if (!ok) {
    set(navigator.onLine ? "no-internet" : "offline");
    startProbing();
  }
}

export function startNetworkWatch() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!navigator.onLine) state = "offline";
  window.addEventListener("offline", () => {
    stopProbing();
    set("offline");
  });
  window.addEventListener("online", async () => {
    // The cable or Wi-Fi is back; make sure the internet is too.
    if (await ping()) set("online");
    else {
      set("no-internet");
      startProbing();
    }
  });
}

export const networkSnapshot = () => state;
export const networkServerSnapshot = (): NetworkState => "online";
export function subscribeNetwork(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
