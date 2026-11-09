import type { Metadata } from "next";
import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { DEFAULT_TEMPLATE, getDocumentTemplate } from "@/server/finance/template";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateEditor } from "@/modules/finance/template-editor";
import { orgLogoUrl } from "@/lib/media";

export const metadata: Metadata = { title: "Document editor" };

async function Editor({ params }: PageProps<"/[organizationSlug]/finance/editor">) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "finance.invoice.read") || !can(ctx, "finance.invoice.issue")) return <PermissionDenied what="the document editor" />;
  const { saved: _saved, ...template } = await getDocumentTemplate(ctx);
  void _saved;
  return (
    <>
      <PageHeader title="Editor" description="Design your invoices, estimates and receipts: layout, colour, logo, business details and wording. Changes show live on the right." />
      <TemplateEditor slug={ctx.organization.slug} initial={template} defaults={{ ...DEFAULT_TEMPLATE, businessName: ctx.organization.name }}
        logoUrl={orgLogoUrl(ctx.organizationId, ctx.organization.logoUpdatedAt)} currency={ctx.organization.currency}
        today={new Intl.DateTimeFormat("en-CA", { timeZone: ctx.organization.timezone }).format(new Date())}
        settingsHref={can(ctx, "organization.update") ? `/${ctx.organization.slug}/settings/general` : null} />
    </>
  );
}

export default function EditorPage(props: PageProps<"/[organizationSlug]/finance/editor">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><div className="grid gap-6 xl:grid-cols-[420px_1fr]"><Skeleton className="h-[600px]" /><Skeleton className="h-[600px]" /></div></div>}><Editor {...props} /></Suspense>;
}
