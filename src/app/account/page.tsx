import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ArrowLeft, Camera, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { getAccount } from "@/server/account/account";
import { safeNextPath } from "@/lib/validation/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmailForm, NameForm, PasswordForm } from "@/modules/account/account-forms";
import { AvatarForm } from "@/modules/account/avatar-form";
import { avatarUrl } from "@/lib/media";
import { initials } from "@/components/ui/avatar";

export const metadata: Metadata = { title: "Account settings", robots: { index: false } };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

async function Account({ searchParams }: { searchParams: Promise<{ setup?: string; next?: string }> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?next=/account");
  const account = await getAccount(user);
  const setup = account.mustChangePassword;
  const next = safeNextPath(sp.next, "/organizations");

  if (setup) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><ShieldCheck className="size-6" aria-hidden /></span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Welcome, {account.name.split(" ")[0]}! Choose your own password</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {account.managedBy ?? "Your organization"} created this login with a temporary password. Pick a new one that only you know; nobody else, including your admin, can see it.
          </p>
        </div>
        <Card className="shadow-sm"><CardContent className="py-6"><PasswordForm setup next={next} /></CardContent></Card>
        <p className="text-center text-xs text-muted-foreground">Signing in as {account.email}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Link href="/organizations?all=1" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Back to workspaces</Link>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">Changes here show up for your workspace admins too, in Members and People.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Camera className="size-4 text-primary" aria-hidden />Profile picture</CardTitle>
          <CardDescription>Shown to people in your workspaces, next to your name.</CardDescription>
        </CardHeader>
        <CardContent><AvatarForm currentUrl={avatarUrl(user.id, user.avatarUpdatedAt)} fallback={initials(account.name)} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-4 text-primary" aria-hidden />Your name</CardTitle></CardHeader>
        <CardContent><NameForm initial={account.name} /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="size-4 text-primary" aria-hidden />Sign-in email</CardTitle>
          <CardDescription>You&apos;ll get a confirmation link at the new address before it changes.</CardDescription>
        </CardHeader>
        <CardContent><EmailForm initial={account.email} /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" aria-hidden />Password</CardTitle>
          <CardDescription>{account.passwordChangedAt ? `Last changed ${fmt(account.passwordChangedAt)}.` : "Use a password you don't use anywhere else."}</CardDescription>
        </CardHeader>
        <CardContent><PasswordForm setup={false} next={next} /></CardContent>
      </Card>
    </div>
  );
}

export default function AccountPage(props: { searchParams: Promise<{ setup?: string; next?: string }> }) {
  return <Suspense fallback={<div className="grid gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}><Account {...props} /></Suspense>;
}
