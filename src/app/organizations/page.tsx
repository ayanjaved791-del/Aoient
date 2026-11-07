import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Building2, CreditCard, Plus, Sparkles, UserPlus } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/organizations/organizations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOrganizationForm } from "@/modules/organization/create-organization-form";
import { hasAcceptedCurrentTerms } from "@/server/legal/acceptance";

export const metadata: Metadata = { title: "Organizations" };

const SETUP_STEPS = [
  { title: "Create workspace", icon: Building2 },
  { title: "Invite your team", icon: UserPlus },
  { title: "Choose a plan", icon: CreditCard },
];

async function OrganizationList() {
  const user = await requireUserOrRedirect("/organizations");
  const orgs = await listUserOrganizations(user.id);

  if (orgs.length === 0) {
    const firstName = user.name.split(" ")[0];
    return (
      <div className="grid gap-8">
        <div className="motion-safe:animate-rise grid gap-2 text-center">
          <span className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-secondary-foreground shadow-xs">
            <Sparkles className="size-3.5 text-primary" aria-hidden />{TRIAL_DAYS}-day free trial, no card needed
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{firstName ? `Welcome, ${firstName}` : "Welcome"}. Let&apos;s set up your workspace</h1>
          <p className="mx-auto max-w-lg text-sm text-muted-foreground">
            Your organization is the workspace your team shares, and you&apos;ll be its owner. If a teammate already uses Aoient, ask them to invite you instead.
          </p>
        </div>
        <ol className="motion-safe:animate-rise grid gap-2 [animation-delay:80ms] sm:grid-cols-3">
          {SETUP_STEPS.map((step, i) => (
            <li key={step.title} className={cn("flex items-center gap-3 rounded-xl border p-3", i === 0 ? "border-primary/40 bg-primary-subtle/60" : "border-border bg-surface")}>
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", i === 0 ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground")}>
                <step.icon className="size-4" aria-hidden />
              </span>
              <span className="grid min-w-0 leading-tight">
                <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                <span className="truncate text-sm font-medium">{step.title}</span>
              </span>
            </li>
          ))}
        </ol>
        <Card className="motion-safe:animate-rise shadow-sm [animation-delay:160ms]"><CardContent className="py-6"><CreateOrganizationForm termsAccepted={await hasAcceptedCurrentTerms(user.id)} /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your organizations</h1>
          <p className="text-sm text-muted-foreground">Choose a workspace to continue.</p>
        </div>
        <Button variant="secondary" asChild><Link href="/organizations/new"><Plus className="size-4" />New organization</Link></Button>
      </div>
      <Card>
        <CardHeader className="sr-only"><CardTitle>Organizations</CardTitle><CardDescription>Workspaces you belong to</CardDescription></CardHeader>
        <ul className="divide-y divide-border">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link href={`/${o.slug}`} className="group flex items-center gap-3 px-5 py-4 hover:bg-surface-muted focus-visible:bg-surface-muted sm:px-6">
                <span className="flex size-9 items-center justify-center rounded-md bg-navy text-sm font-semibold text-white dark:bg-primary">{o.name.slice(0, 1).toUpperCase()}</span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-sm font-medium">{o.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{o.roleName}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<div className="grid gap-4"><Skeleton className="h-8 w-60" /><Skeleton className="h-40 w-full" /></div>}>
      <OrganizationList />
    </Suspense>
  );
}
