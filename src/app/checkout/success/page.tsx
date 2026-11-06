import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUserOrRedirect } from "@/server/auth/session";
import { lookupTransaction } from "@/server/billing/paddle-transactions";
import { PaymentSuccess } from "@/modules/billing/payment-success";
import { resolveOrgContext } from "@/server/tenancy/context";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Payment successful" };

async function ConfirmedPayment({ searchParams }: { searchParams: Promise<{ txn?: string }> }) {
  const { txn } = await searchParams;
  const here = `/checkout/success${txn ? `?txn=${encodeURIComponent(txn)}` : ""}`;
  const user = await requireUserOrRedirect(here);
  // The transaction ID comes from the browser, so it is only a lookup key:
  // Paddle's API (server-side, secret key) decides whether it was paid and by whom.
  const result = await lookupTransaction(txn, user.email);
  // Link to the workspace the plan is for, but only if this user belongs to it.
  let workspace: { name: string; slug: string } | null = null;
  if (result.kind === "paid" && result.details.organizationId) {
    workspace = await resolveOrgContext(user.id, { id: result.details.organizationId })
      .then((ctx) => ({ name: ctx.organization.name, slug: ctx.organization.slug }))
      .catch(() => null);
  }
  return <PaymentSuccess result={result} firstName={user.name.split(" ")[0] ?? ""} retryHref={here} workspace={workspace} />;
}

export default function PaymentSuccessPage(props: { searchParams: Promise<{ txn?: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid max-w-2xl justify-items-center gap-4 px-4 py-20" aria-busy="true">
          <Skeleton className="size-24 rounded-full" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <ConfirmedPayment {...props} />
    </Suspense>
  );
}
