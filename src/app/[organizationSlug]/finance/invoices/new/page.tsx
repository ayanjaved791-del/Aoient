import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentEditor } from "../../_components/documents";

export const metadata: Metadata = { title: "New invoice" };

async function Page({ params }: PageProps<"/[organizationSlug]/finance/invoices/new">) {
  const { organizationSlug } = await params;
  return <DocumentEditor slug={organizationSlug} kind="invoice" />;
}

export default function NewInvoicePage(props: PageProps<"/[organizationSlug]/finance/invoices/new">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-48" /><Skeleton className="h-72" /><Skeleton className="h-56" /></div>}><Page {...props} /></Suspense>;
}
