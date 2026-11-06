"use client";
import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { openBillingPortalAction } from "@/modules/organization/actions";
import { Button } from "@/components/ui/button";

/** Opens Paddle's customer portal (payment method, invoices, cancel) via a one-time server-made link. */
export function ManageSubscriptionButton({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <Button
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await openBillingPortalAction(slug);
            if (res.ok) window.location.assign(res.data.url);
            else setError(res.error.message);
          })
        }
      >
        Manage subscription <ExternalLink className="size-4" aria-hidden />
      </Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
