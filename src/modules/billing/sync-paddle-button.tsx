"use client";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncPaddleLicenseAction } from "@/modules/organization/actions";
import { Button } from "@/components/ui/button";

/**
 * Re-reads this workspace's subscription from Paddle (server-side, secret key).
 * For when a purchase finished but the webhook hasn't arrived.
 */
export function SyncPaddleButton({ slug, label = "Already paid? Sync with Paddle" }: { slug: string; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await syncPaddleLicenseAction(slug);
          if (!res.ok) return void toast.error(res.error.message);
          const r = res.data;
          if (r.kind === "done" && r.outcome === "applied") toast.success("Your plan is active. Thanks for subscribing!");
          else if (r.kind === "done") toast.info("Your plan is already up to date.");
          else if (r.kind === "none") toast.info("Paddle has no subscription for this workspace yet. If you just paid, wait a minute and try again.");
          else if (r.kind === "not-configured") toast.error("PADDLE_API_KEY isn't set on the server, so Paddle can't be checked.");
          else toast.error("Couldn't reach Paddle right now. Try again in a moment.");
        })
      }
    >
      <RefreshCw className="size-4" aria-hidden />{label}
    </Button>
  );
}
