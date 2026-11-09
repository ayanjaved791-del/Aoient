import type { Metadata } from "next";
import { Suspense } from "react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getWorkload } from "@/server/projects/projects";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Workload" };

async function Workload({ params }: PageProps<"/[organizationSlug]/projects/workload">) {
  const { organizationSlug } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "projects.project.update")) return <PermissionDenied what="the team's workload" />;
  const rows = await getWorkload(ctx);
  const max = Math.max(1, ...rows.map((r) => r.open));

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="Workload" description="Open tasks per person, across every active project. Spot who's stretched before deadlines slip." />
      <Card className="min-w-0 overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface-muted text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Person</th>
                <th scope="col" className="w-[38%] px-4 py-2.5 font-medium">Open tasks</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">In progress</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Due in 7 days</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Overdue</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Done (7 days)</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Projects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={r.memberId} className="motion-safe:animate-rise hover:bg-surface-muted/50" style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}>
                  <td className="px-4 py-3"><span className="flex items-center gap-2.5"><Avatar name={r.name} size="sm" /><span className="truncate font-medium">{r.name}{r.memberId === ctx.memberId && <span className="font-normal text-muted-foreground"> (you)</span>}</span></span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                        {r.open > 0 && <div className={cn("h-full origin-left rounded-full motion-safe:animate-grow-x", r.overdue > 0 ? "bg-danger" : "bg-primary")} style={{ width: `${Math.max(4, (r.open / max) * 100)}%`, animationDelay: `${200 + i * 50}ms` }} />}
                      </div>
                      <span className="w-6 text-right font-semibold tabular-nums">{r.open}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.inProgress}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.dueThisWeek}</td>
                  <td className={cn("px-4 py-3 text-right tabular-nums", r.overdue > 0 && "font-semibold text-danger")}>{r.overdue}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">{r.doneLast7}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.projects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function WorkloadPage(props: PageProps<"/[organizationSlug]/projects/workload">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-96" /></div>}><Workload {...props} /></Suspense>;
}
