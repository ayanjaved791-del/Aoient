import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CreateOrganizationForm } from "@/modules/organization/create-organization-form";

export const metadata: Metadata = { title: "New organization" };

export default function NewOrganizationPage() {
  return (
    <div className="grid gap-6">
      <Link href="/organizations" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />All organizations
      </Link>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create an organization</h1>
        <p className="text-sm text-muted-foreground">Each organization has its own members, data, settings and subscription.</p>
      </div>
      <Card><CardContent className="py-6"><CreateOrganizationForm /></CardContent></Card>
    </div>
  );
}
