import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUserOrRedirect } from "@/server/auth/session";
import { PLANS, type BillingInterval } from "@/lib/billing/plans";
import { CheckoutPage } from "@/modules/billing/checkout-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Checkout" };

async function SignedInCheckout({
  params,
  searchParams,
}: {
  params: Promise<{ plan: string }>;
  searchParams: Promise<{ interval?: string }>;
}) {
  const [{ plan: planId }, { interval: rawInterval }] = await Promise.all([params, searchParams]);
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) notFound();
  const interval: BillingInterval = rawInterval === "yearly" ? "yearly" : "monthly";
  const user = await requireUserOrRedirect(`/checkout/${plan.id}?interval=${interval}`);
  return <CheckoutPage planId={plan.id} initialInterval={interval} user={{ name: user.name, email: user.email }} />;
}

export default function Checkout(props: { params: Promise<{ plan: string }>; searchParams: Promise<{ interval?: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 lg:grid-cols-[1fr_1.1fr]" aria-busy="true">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      }
    >
      <SignedInCheckout {...props} />
    </Suspense>
  );
}
