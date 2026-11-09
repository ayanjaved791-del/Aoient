import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptView } from "../../../../_components/documents";

export const metadata: Metadata = { title: "Receipt" };

async function Page({ params }: PageProps<"/[organizationSlug]/finance/invoices/[documentId]/receipts/[paymentId]">) {
  const { organizationSlug, documentId, paymentId } = await params;
  return <ReceiptView slug={organizationSlug} invoiceId={documentId} paymentId={paymentId} />;
}

export default function ReceiptPage(props: PageProps<"/[organizationSlug]/finance/invoices/[documentId]/receipts/[paymentId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-[420px]" /></div>}><Page {...props} /></Suspense>;
}
