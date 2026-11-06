import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUserOrRedirect } from "@/server/auth/session";
import { PricingPage } from "@/modules/billing/pricing-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Pricing" };

async function SignedInPricing() {
  const user = await requireUserOrRedirect("/pricing");
  return <PricingPage user={{ name: user.name, email: user.email }} />;
}

export default function Pricing() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid max-w-5xl gap-4 px-4 py-16" aria-busy="true">
          <Skeleton className="mx-auto h-9 w-72" />
          <div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-96" />)}</div>
        </div>
      }
    >
      <SignedInPricing />
    </Suspense>
  );
}
