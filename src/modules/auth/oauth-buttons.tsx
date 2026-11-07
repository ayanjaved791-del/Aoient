"use client";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isGoogleAuthEnabled } from "@/lib/supabase/config";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { describeAuthError } from "./auth-error";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.02c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

/** "Continue with Google" plus an "or" divider. Renders nothing until Google sign-in is enabled. */
export function OAuthButtons({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isGoogleAuthEnabled) return null;

  async function google() {
    setError(null);
    setBusy(true);
    const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    // On success the browser is already navigating to Google.
    if (error) {
      setBusy(false);
      setError(describeAuthError(error, "Google sign-in isn't available right now."));
    }
  }

  return (
    <div className="grid gap-4">
      {error && <Alert tone="danger" title={error} />}
      <Button type="button" variant="secondary" className="w-full" loading={busy} onClick={google}>
        {!busy && <GoogleMark />}Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
