import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUserOrRedirect } from "@/server/auth/session";
import { PLANS, type BillingInterval } from "@/lib/billing/plans";
import { hasLivePaidSubscription, listBillableOrganizations, loadLicense } from "@/server/billing/license";
import { signCheckout } from "@/server/billing/checkout-token";
import { getDb } from "@/server/database/client";
import { CheckoutPage, type CheckoutTarget } from "@/modules/billing/checkout-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Checkout" };

type Search = { interval?: string; org?: string };

async function SignedInCheckout({ params, searchParams }: { params: Promise<{ plan: string }>; searchParams: Promise<Search> }) {
  const [{ plan: planId }, search] = await Promise.all([params, searchParams]);
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) notFound();
  const interval: BillingInterval = search.interval === "yearly" ? "yearly" : "monthly";
  const orgQuery = search.org ? `&org=${encodeURIComponent(search.org)}` : "";
  const user = await requireUserOrRedirect(`/checkout/${plan.id}?interval=${interval}${orgQuery}`);

  // Which workspace is this for? Only ones where the user may manage billing —
  // decided here on the server, never taken from the browser as-is.
  const billable = await listBillableOrganizations(user.id);
  let target: CheckoutTarget;
  const chosen = search.org ? billable.find((o) => o.slug === search.org) : billable.length === 1 ? billable[0] : undefined;
  if (billable.length === 0) {
    target = { kind: "no-organization" };
  } else if (!chosen) {
    target = { kind: "choose", organizations: billable };
  } else {
    const license = await loadLicense(getDb(), chosen.id);
    const token = signCheckout(chosen.id, user.id);
    if (hasLivePaidSubscription(license)) target = { kind: "already-subscribed", organization: chosen };
    else if (!token) target = { kind: "not-configured", organization: chosen };
    else target = { kind: "ready", organization: chosen, checkoutToken: token };
  }

  return <CheckoutPage planId={plan.id} initialInterval={interval} user={{ name: user.name, email: user.email }} target={target} />;
}

export default function Checkout(props: { params: Promise<{ plan: string }>; searchParams: Promise<Search> }) {
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
