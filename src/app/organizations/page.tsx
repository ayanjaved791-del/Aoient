import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/organizations/organizations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOrganizationForm } from "@/modules/organization/create-organization-form";

export const metadata: Metadata = { title: "Organizations" };

async function OrganizationList() {
  const user = await requireUserOrRedirect("/organizations");
  const orgs = await listUserOrganizations(user.id);

  if (orgs.length === 0) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Set up your organization</h1>
          <p className="text-sm text-muted-foreground">
            Your organization is the workspace your team shares. You&apos;ll be its owner. If a teammate already uses Aoient, ask them to invite you instead.
          </p>
        </div>
        <Card><CardContent className="py-6"><CreateOrganizationForm /></CardContent></Card>
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
