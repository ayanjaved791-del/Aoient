"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import { getLocalSessionUser, isLocalAuth, localSignOut, type LocalUser } from "@/lib/local-auth";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PENDING = "pending";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
// Snapshots must be stable between renders, so serialise to a string.
function snapshot(): string {
  try {
    return JSON.stringify(getLocalSessionUser());
  } catch {
    return "null";
  }
}

export function LocalHome() {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribe, snapshot, () => PENDING);
  const user = useMemo(() => (raw === PENDING ? undefined : (JSON.parse(raw) as LocalUser | null)), [raw]);

  useEffect(() => {
    if (!isLocalAuth) router.replace("/organizations");
    else if (user === null) router.replace("/sign-in");
  }, [user, router]);

  function signOut() {
    localSignOut();
    router.replace("/sign-in");
  }

  if (!user) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-16" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Aoient home" className="rounded-md"><Logo /></Link>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={user.name} />
            <span className="hidden min-w-0 truncate text-sm font-medium sm:block">{user.name}</span>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut className="size-4" aria-hidden /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">You&apos;re signed in.</p>
        </div>
        <Alert tone="warning" title="Browser-only mode">
          Your account is saved in this browser only. It won&apos;t appear on other browsers or devices, and clearing site
          data deletes it. Organizations, team members and business modules will be enabled once the database is connected.
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>Details stored in this browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div className="min-w-0"><dt className="text-muted-foreground">Name</dt><dd className="mt-1 truncate font-medium">{user.name}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">Email</dt><dd className="mt-1 truncate font-medium">{user.email}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">Created</dt><dd className="mt-1 font-medium">{new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
