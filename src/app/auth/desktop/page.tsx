import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "@/modules/auth/auth-card";
import { desktopReturnLink } from "@/lib/desktop";
import { OpenDesktopApp } from "./open-app";

export const metadata: Metadata = { title: "Back to the app", robots: { index: false }, referrer: "no-referrer" };

/** Shown in the system browser after Google sign-in that started in the desktop app. */
async function Handoff({ searchParams }: { searchParams: Promise<{ code?: string; next?: string; error?: string }> }) {
  const sp = await searchParams;
  const link = sp.error ? null : desktopReturnLink(sp.code, sp.next);
  if (!link) {
    return (
      <AuthCard title="Sign-in didn't finish">
        <Alert tone="warning" title="Google sign-in was cancelled or failed.">
          Go back to the Aoient app and try again, or sign in with your email and password.
        </Alert>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="You're signed in with Google"
      description="Switch back to the Aoient app to continue. If your browser asks, allow it to open Aoient."
      footer={<>Once the app opens you can close this tab. No app? <Link href="/download" className="font-medium text-foreground underline underline-offset-4">Download it</Link>.</>}
    >
      <OpenDesktopApp href={link} />
    </AuthCard>
  );
}

export default function DesktopHandoffPage(props: { searchParams: Promise<{ code?: string; next?: string; error?: string }> }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-4 py-5 sm:px-8"><Link href="/" aria-label="Aoient home"><Logo /></Link></header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[400px]">
          <Suspense fallback={<div className="grid gap-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-28 w-full" /></div>}>
            <Handoff {...props} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
