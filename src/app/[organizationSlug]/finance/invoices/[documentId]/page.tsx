import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentView } from "../../_components/documents";

export const metadata: Metadata = { title: "Invoice" };

async function Page({ params }: PageProps<"/[organizationSlug]/finance/invoices/[documentId]">) {
  const { organizationSlug, documentId } = await params;
  return <DocumentView slug={organizationSlug} kind="invoice" id={documentId} />;
}

export default function InvoicePage(props: PageProps<"/[organizationSlug]/finance/invoices/[documentId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-[480px]" /></div>}><Page {...props} /></Suspense>;
}
