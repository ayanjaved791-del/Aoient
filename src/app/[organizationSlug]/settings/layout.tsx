import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { SettingsNav } from "@/modules/organization/settings-nav";

async function Nav({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  return <SettingsNav base={`/${ctx.organization.slug}/settings`} />;
}

export default function SettingsLayout({ children, params }: LayoutProps<"/[organizationSlug]/settings">) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[200px_1fr]">
      <aside className="min-w-0"><Suspense fallback={null}><Nav params={params} /></Suspense></aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
