import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentView } from "../../_components/documents";

export const metadata: Metadata = { title: "Estimate" };

async function Page({ params }: PageProps<"/[organizationSlug]/finance/estimates/[documentId]">) {
  const { organizationSlug, documentId } = await params;
  return <DocumentView slug={organizationSlug} kind="estimate" id={documentId} />;
}

export default function EstimatePage(props: PageProps<"/[organizationSlug]/finance/estimates/[documentId]">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-[480px]" /></div>}><Page {...props} /></Suspense>;
}
