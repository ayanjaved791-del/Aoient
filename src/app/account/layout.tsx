import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="relative isolate min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent)]" />
      <header className="flex h-14 items-center border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-6">
        <Link href="/organizations" aria-label="Aoient"><Logo /></Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
