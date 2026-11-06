import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUserOrRedirect } from "@/server/auth/session";
import { lookupTransaction } from "@/server/billing/paddle-transactions";
import { PaymentSuccess } from "@/modules/billing/payment-success";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Payment successful" };

async function ConfirmedPayment({ searchParams }: { searchParams: Promise<{ txn?: string }> }) {
  const { txn } = await searchParams;
  const here = `/checkout/success${txn ? `?txn=${encodeURIComponent(txn)}` : ""}`;
  const user = await requireUserOrRedirect(here);
  // The transaction ID comes from the browser, so it is only a lookup key:
  // Paddle's API (server-side, secret key) decides whether it was paid and by whom.
  const result = await lookupTransaction(txn, user.email);
  return <PaymentSuccess result={result} firstName={user.name.split(" ")[0] ?? ""} retryHref={here} />;
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
