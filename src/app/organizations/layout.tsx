import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { requireUserOrRedirect } from "@/server/auth/session";

async function AccountMenu() {
  const user = await requireUserOrRedirect("/organizations");
  return <UserMenu name={user.name} email={user.email} />;
}

export default function OrganizationsLayout({ children }: LayoutProps<"/organizations">) {
  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
        <Link href="/organizations" aria-label="Aoient"><Logo /></Link>
        <Suspense fallback={<span className="size-8 rounded-full bg-surface-muted" />}><AccountMenu /></Suspense>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
