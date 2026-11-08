import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { avatarUrl } from "@/lib/media";
import { UserMenu } from "@/components/layout/user-menu";
import { requireUserOrRedirect } from "@/server/auth/session";

async function AccountMenu() {
  const user = await requireUserOrRedirect("/organizations");
  return <UserMenu name={user.name} email={user.email} avatarUrl={avatarUrl(user.id, user.avatarUpdatedAt)} />;
}

export default function OrganizationsLayout({ children }: LayoutProps<"/organizations">) {
  return (
    <div className="relative isolate min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]" />
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-6">
        <Link href="/organizations" aria-label="Aoient"><Logo /></Link>
        <Suspense fallback={<span className="size-8 rounded-full bg-surface-muted" />}><AccountMenu /></Suspense>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
