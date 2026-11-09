import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentEditor } from "../../_components/documents";

export const metadata: Metadata = { title: "New estimate" };

async function Page({ params }: PageProps<"/[organizationSlug]/finance/estimates/new">) {
  const { organizationSlug } = await params;
  return <DocumentEditor slug={organizationSlug} kind="estimate" />;
}

export default function NewEstimatePage(props: PageProps<"/[organizationSlug]/finance/estimates/new">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-48" /><Skeleton className="h-72" /><Skeleton className="h-56" /></div>}><Page {...props} /></Suspense>;
}
