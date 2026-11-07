import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, Pencil, Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listDepartments } from "@/server/people/departments";
import { listEmployees } from "@/server/people/employees";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { DeleteDepartmentButton, DepartmentDialog } from "@/modules/people/department-dialog";

export const metadata: Metadata = { title: "Departments" };

async function Departments({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "people.employee.read")) return <PermissionDenied what="departments" />;
  const slug = ctx.organization.slug;
  const canManage = can(ctx, "people.department.manage");
  const [departments, people] = await Promise.all([listDepartments(ctx), canManage ? listEmployees(ctx) : null]);
  const options = (people ?? []).map((p) => ({ id: p.id, name: p.fullName }));
  const add = canManage ? <DepartmentDialog slug={slug} people={options} trigger={<Button><Plus />New department</Button>} /> : undefined;

  return (
    <div className="grid gap-6">
      <PageHeader title="Departments" description="Teams in your organization and who leads them." actions={add} />
      {departments.length === 0 ? (
        <Card><EmptyState icon={Building2} title="No departments yet" description={canManage ? "Create teams like Front desk, Nursing or Sales." : "HR or an admin can create departments."} action={add} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((d) => (
            <Card key={d.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><Building2 className="size-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{d.name}</h2>
                  <p className="text-xs text-muted-foreground">{d.employeeCount} {d.employeeCount === 1 ? "person" : "people"}</p>
                </div>
                {canManage && (
                  <div className="flex">
                    <DepartmentDialog slug={slug} people={options} department={{ id: d.id, name: d.name, description: d.description, headId: d.head?.id ?? null }}
                      trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${d.name}`}><Pencil /></Button>} />
                    <DeleteDepartmentButton slug={slug} id={d.id} name={d.name} count={d.employeeCount} />
                  </div>
                )}
              </div>
              {d.description && <p className="mt-3 text-sm text-muted-foreground">{d.description}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 mt-4">
                {d.head ? (
                  <Link href={`/${slug}/people/${d.head.id}`} className="flex items-center gap-2 text-sm hover:underline"><Avatar name={d.head.name} size="sm" />{d.head.name}<span className="text-xs text-muted-foreground">· head</span></Link>
                ) : <span className="text-sm text-muted-foreground">No head set</span>}
                <Link href={`/${slug}/people?dept=${d.id}`} className="text-sm font-medium text-primary hover:underline">View people</Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DepartmentsPage(props: { params: Promise<{ organizationSlug: string }> }) {
  return <Suspense fallback={<div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}><Departments {...props} /></Suspense>;
}
