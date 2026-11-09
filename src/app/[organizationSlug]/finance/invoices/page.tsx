import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentList } from "../_components/documents";

export const metadata: Metadata = { title: "Invoices" };

async function Page({ params, searchParams }: PageProps<"/[organizationSlug]/finance/invoices">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  return <DocumentList slug={organizationSlug} kind="invoice" sp={sp} />;
}

export default function InvoicesPage(props: PageProps<"/[organizationSlug]/finance/invoices">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-10" /><Skeleton className="h-72" /></div>}><Page {...props} /></Suspense>;
}
