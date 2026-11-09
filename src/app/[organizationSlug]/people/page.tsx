import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, CalendarClock, CalendarOff, ChevronRight, Plus, UserPlus, Users } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getMyEmployeeId, getPeopleStats, listEmployees, listUnlinkedMembers } from "@/server/people/employees";
import { listDepartments } from "@/server/people/departments";
import { listGrantableRoles } from "@/server/people/accounts";
import { whoIsOut } from "@/server/people/leave";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDialog } from "@/modules/people/employee-dialog";
import { EMPLOYMENT_LABELS } from "@/modules/people/labels";
import { PeopleFilters } from "@/modules/people/people-filters";

export const metadata: Metadata = { title: "People" };

type Props = PageProps<"/[organizationSlug]/people">;

const LEAVE_LABEL: Record<string, string> = { annual: "Annual leave", sick: "Sick leave", unpaid: "Unpaid leave", other: "Leave" };
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Stat({ icon: Icon, label, value, href }: { icon: typeof Users; label: string; value: number | string; href?: string }) {
  const body = (
    <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary/40">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Icon className="size-4" aria-hidden /></span>
      <span className="grid"><span className="text-xl font-semibold">{value}</span><span className="text-xs text-muted-foreground">{label}</span></span>
    </Card>
  );
  return href ? <Link href={href} className="rounded-lg">{body}</Link> : body;
}

async function Directory({ params, searchParams }: Props) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}/people`;
  if (!can(ctx, "people.employee.read")) {
    const mine = await getMyEmployeeId(ctx);
    return mine ? (
      <Card className="p-6"><p className="text-sm">Your role can&apos;t browse the directory, but you can open <Link className="font-medium text-primary hover:underline" href={`${base}/${mine}`}>your own profile</Link>.</p></Card>
    ) : <PermissionDenied what="People" />;
  }

  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const departmentId = typeof sp.dept === "string" ? sp.dept : undefined;
  const status = sp.status === "archived" || sp.status === "all" ? sp.status : "active";
  const canCreate = can(ctx, "people.employee.create");
  const [employees, departments, stats, out, myId, everyone, members, loginRoles] = await Promise.all([
    listEmployees(ctx, { query, departmentId, status }),
    listDepartments(ctx),
    getPeopleStats(ctx),
    whoIsOut(ctx),
    getMyEmployeeId(ctx),
    canCreate ? listEmployees(ctx, { status: "active" }) : null,
    canCreate && can(ctx, "people.employee.sensitive.read") ? listUnlinkedMembers(ctx) : null,
    canCreate && can(ctx, "people.employee.update") && can(ctx, "people.employee.sensitive.read") ? listGrantableRoles(ctx) : null,
  ]);
  const filtered = Boolean(query || departmentId || status !== "active");

  const addButton = canCreate ? (
    <EmployeeDialog slug={ctx.organization.slug} trigger={<Button><UserPlus />Add employee</Button>}
      departments={departments} managers={(everyone ?? []).map((e) => ({ id: e.id, name: e.fullName }))} members={members}
      canSensitive={can(ctx, "people.employee.sensitive.read")} defaultCurrency={ctx.organization.currency}
      loginRoles={loginRoles} organizationName={ctx.organization.name} />
  ) : undefined;

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <PageHeader title="People" description={`Everyone who works with ${ctx.organization.name}, with or without an Aoient account.`}
        actions={<>{myId && <Button variant="secondary" asChild><Link href={`${base}/${myId}`}>My profile</Link></Button>}{addButton}</>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Active people" value={stats.headcount} />
        <Stat icon={Building2} label="Departments" value={stats.departments} href={`${base}/departments`} />
        <Stat icon={CalendarOff} label="On leave today" value={stats.onLeaveToday} />
        {stats.pendingLeave !== null
          ? <Stat icon={CalendarClock} label="Leave to review" value={stats.pendingLeave} href={`${base}/leave?tab=team`} />
          : <Stat icon={UserPlus} label="Started this month" value={stats.joinedThisMonth} />}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid min-w-0 content-start gap-4">
          <PeopleFilters departments={departments} />
          <Card className="min-w-0 overflow-hidden">
            {employees.length === 0 ? (
              <EmptyState icon={Users} title={filtered ? "No one matches these filters" : "No one in People yet"}
                description={filtered ? "Try a different search or filter." : canCreate ? "Add your team, including people who don't need an Aoient account." : "HR or an admin can add people here."}
                action={!filtered && addButton ? addButton : undefined} />
            ) : (
              <div className="scroll-thin relative overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-surface-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Department</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Manager</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                      <th scope="col" className="w-8"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {employees.map((e) => (
                      <tr key={e.id} className="group relative hover:bg-surface-muted/60">
                        <td className="px-4 py-3">
                          <Link href={`${base}/${e.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                            <Avatar name={e.fullName} src={e.avatarUrl} />
                            <span className="grid min-w-0">
                              <span className="truncate font-medium">{e.fullName}{e.id === myId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}</span>
                              <span className="truncate text-xs text-muted-foreground">{e.jobTitle ?? e.workEmail ?? "—"}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-secondary-foreground">{e.department?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-secondary-foreground">{e.manager?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-secondary-foreground">{EMPLOYMENT_LABELS[e.employmentType]}</td>
                        <td className="px-4 py-3">
                          {e.status === "archived" ? <Badge>Archived</Badge> : e.onLeaveToday ? <Badge tone="warning">On leave</Badge> : <Badge tone="success">Active</Badge>}
                        </td>
                        <td className="pr-3 text-muted-foreground"><ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {employees.length > 0 && <p className="text-xs text-muted-foreground">{employees.length} {employees.length === 1 ? "person" : "people"}{filtered ? " match" : ""}</p>}
        </div>

        <aside className="grid content-start gap-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarOff className="size-4 text-warning" aria-hidden />Out today</h2>
            {out.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Everyone is in today.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {out.map((o) => (
                  <li key={o.id}>
                    <Link href={`${base}/${o.id}`} className="flex items-center gap-2.5 rounded-md hover:opacity-80">
                      <Avatar name={o.name} size="sm" />
                      <span className="grid min-w-0"><span className="truncate text-sm font-medium">{o.name}</span><span className="text-xs text-muted-foreground">{LEAVE_LABEL[o.type]} · back after {shortDate(o.until)}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {stats.byType.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">By employment type</h2>
              <ul className="mt-3 grid gap-2.5">
                {stats.byType.map((t) => (
                  <li key={t.type} className="grid gap-1">
                    <div className="flex justify-between text-sm"><span>{EMPLOYMENT_LABELS[t.type]}</span><span className="font-medium tabular-nums">{t.count}</span></div>
                    <div className="h-1.5 rounded-full bg-primary-subtle"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (t.count / Math.max(1, stats.headcount)) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {can(ctx, "people.department.manage") && departments.length === 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Organise by department</h2>
              <p className="mt-1 text-sm text-muted-foreground">Group people into teams like Front desk, Nursing or Sales.</p>
              <Button variant="secondary" size="sm" className="mt-3" asChild><Link href={`${base}/departments`}><Plus />Add a department</Link></Button>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function PeoplePage(props: Props) {
  return (
    <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-10 w-60" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-96" /></div>}>
      <Directory {...props} />
    </Suspense>
  );
}
