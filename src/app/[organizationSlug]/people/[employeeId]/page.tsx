import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Briefcase, Clock, KeyRound, Building2, CalendarDays, Lock, Mail, MapPin, Pencil, Phone, UserRound, Users } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { getEmployee, listEmployees, listUnlinkedMembers } from "@/server/people/employees";
import { listDepartments } from "@/server/people/departments";
import { listLeaveForEmployee } from "@/server/people/leave";
import { getEmployeeLogin, listGrantableRoles } from "@/server/people/accounts";
import { CreateLoginDialog, ResetPasswordDialog } from "@/modules/people/login-ui";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { EmployeeDialog, type EmployeeFormValues } from "@/modules/people/employee-dialog";
import { EMPLOYMENT_LABELS, LEAVE_LABELS } from "@/modules/people/labels";
import { ArchiveEmployeeButton } from "@/modules/people/archive-button";
import { LeaveStatusBadge } from "@/modules/people/leave-ui";

export const metadata: Metadata = { title: "Employee" };

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const money = (n: number, cur: string | null) => new Intl.NumberFormat("en-US", { style: "currency", currency: cur ?? "USD", maximumFractionDigits: 2 }).format(n);

function Row({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="grid min-w-0"><span className="text-xs text-muted-foreground">{label}</span><span className="text-sm [overflow-wrap:anywhere]">{children}</span></div>
    </div>
  );
}

async function Profile({ params }: { params: Promise<{ organizationSlug: string; employeeId: string }> }) {
  const { organizationSlug, employeeId } = await params;
  const { ctx } = await getPageOrgContext(organizationSlug);
  const base = `/${ctx.organization.slug}/people`;
  let e;
  try {
    e = await getEmployee(ctx, employeeId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) return <PermissionDenied what="this profile" />;
    throw err;
  }
  const canEdit = can(ctx, "people.employee.update");
  const canSensitiveEdit = can(ctx, "people.employee.sensitive.read");
  const canCreateLogin = !e.memberId && e.status === "active" && canEdit && can(ctx, "organization.members.invite") && can(ctx, "people.employee.sensitive.read");
  const [leave, departments, everyone, members, login, roles] = await Promise.all([
    listLeaveForEmployee(ctx, e.id),
    canEdit ? listDepartments(ctx) : null,
    canEdit ? listEmployees(ctx, { status: "active" }) : null,
    canEdit && can(ctx, "people.employee.create") && can(ctx, "people.employee.sensitive.read") ? listUnlinkedMembers(ctx, e.id) : null,
    e.memberId && (can(ctx, "organization.members.read") || e.isSelf) ? getEmployeeLogin(ctx, e.id) : null,
    canCreateLogin ? listGrantableRoles(ctx) : null,
  ]);
  const s = e.sensitive;
  const initial: EmployeeFormValues = {
    fullName: e.fullName, workEmail: e.workEmail ?? "", phone: e.phone ?? "", jobTitle: e.jobTitle ?? "", employeeCode: e.employeeCode ?? "",
    departmentId: e.department?.id ?? "", managerId: e.manager?.id ?? "", memberId: e.memberId ?? "", employmentType: e.employmentType,
    location: e.location ?? "", startDate: e.startDate ?? "",
    dateOfBirth: s?.dateOfBirth ?? "", personalEmail: s?.personalEmail ?? "", homeAddress: s?.homeAddress ?? "",
    emergencyContactName: s?.emergencyContactName ?? "", emergencyContactPhone: s?.emergencyContactPhone ?? "",
    salaryAmount: s?.salaryAmount != null ? String(s.salaryAmount) : "", salaryCurrency: s?.salaryCurrency ?? "", salaryPeriod: s?.salaryPeriod ?? "monthly",
  };
  // Members already linked elsewhere aren't offered; keep this record's own link visible.
  const memberOptions = members ? members.map((m) => ({ id: m.id, name: m.name, email: m.email })) : null;

  return (
    <div className="grid gap-6">
      {can(ctx, "people.employee.read") && (
        <Link href={base} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />All people</Link>
      )}

      <Card className="relative overflow-hidden">
        <div aria-hidden className="h-24 bg-gradient-to-r from-violet-500/80 via-fuchsia-500/60 to-orange-400/70" />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <Avatar name={e.fullName} src={e.avatarUrl} className="-mt-10 size-20 border-4 border-surface text-xl" />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {e.fullName}
              {e.isSelf && <Badge tone="primary">You</Badge>}
              {e.status === "archived" ? <Badge>Archived</Badge> : e.onLeaveToday ? <Badge tone="warning">On leave today</Badge> : null}
            </h1>
            <p className="text-sm text-muted-foreground">{[e.jobTitle, e.department?.name].filter(Boolean).join(" · ") || "No job title yet"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && departments && everyone && (
              <EmployeeDialog slug={ctx.organization.slug} employeeId={e.id} initial={initial} trigger={<Button variant="secondary"><Pencil />Edit</Button>}
                departments={departments} managers={everyone.map((x) => ({ id: x.id, name: x.fullName }))} members={memberOptions}
                canSensitive={canSensitiveEdit} defaultCurrency={ctx.organization.currency} />
            )}
            {can(ctx, "people.employee.archive") && !e.isSelf && <ArchiveEmployeeButton slug={ctx.organization.slug} id={e.id} name={e.fullName} archived={e.status === "archived"} />}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Work details</h2>
          <div className="mt-2 grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 sm:gap-x-6">
            <Row icon={Mail} label="Work email">{e.workEmail ? <a className="text-primary hover:underline" href={`mailto:${e.workEmail}`}>{e.workEmail}</a> : "—"}</Row>
            <Row icon={Phone} label="Phone">{e.phone ? <a className="hover:underline" href={`tel:${e.phone}`}>{e.phone}</a> : "—"}</Row>
            <Row icon={Briefcase} label="Employment">{EMPLOYMENT_LABELS[e.employmentType]}{e.employeeCode ? ` · ID ${e.employeeCode}` : ""}</Row>
            <Row icon={Building2} label="Department">{e.department?.name ?? "—"}</Row>
            <Row icon={UserRound} label="Manager">{e.manager ? <Link className="text-primary hover:underline" href={`${base}/${e.manager.id}`}>{e.manager.name}</Link> : "—"}</Row>
            <Row icon={MapPin} label="Location">{e.location ?? "—"}</Row>
            <Row icon={CalendarDays} label="Start date">{e.startDate ? longDate(e.startDate) : "—"}</Row>
            <Row icon={Users} label="Aoient account">{e.memberId ? "Linked" : "Not linked"}</Row>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Lock className="size-3.5 text-warning" aria-hidden />Private details</h2>
          {s ? (
            <div className="mt-2 divide-y divide-border">
              <Row icon={Briefcase} label="Salary">{s.salaryAmount != null ? `${money(s.salaryAmount, s.salaryCurrency)} / ${s.salaryPeriod === "yearly" ? "year" : s.salaryPeriod === "hourly" ? "hour" : "month"}` : "—"}</Row>
              <Row icon={CalendarDays} label="Date of birth">{s.dateOfBirth ? longDate(s.dateOfBirth) : "—"}</Row>
              <Row icon={Mail} label="Personal email">{s.personalEmail ?? "—"}</Row>
              <Row icon={Phone} label="Emergency contact">{s.emergencyContactName ? `${s.emergencyContactName}${s.emergencyContactPhone ? ` · ${s.emergencyContactPhone}` : ""}` : "—"}</Row>
              <Row icon={MapPin} label="Home address">{s.homeAddress ?? "—"}</Row>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Only HR and {e.fullName} can see salary, birthday and emergency contacts.</p>
          )}
        </Card>
      </div>

      {(login || canCreateLogin) && (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-primary" aria-hidden />Aoient login</h2>
              {login ? (
                <div className="mt-3 grid gap-2 text-sm">
                  <p><span className="text-muted-foreground">Signs in as </span><span className="font-medium">{login.email}</span><span className="text-muted-foreground"> · {login.roleName}{login.memberStatus === "suspended" ? " · suspended" : ""}</span></p>
                  {login.mustChangePassword ? (
                    <p className="flex items-center gap-1.5 text-warning"><Clock className="size-3.5" aria-hidden />Temporary password: they&apos;ll choose their own at next sign-in.</p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-success"><BadgeCheck className="size-3.5" aria-hidden />{login.passwordChangedAt ? `Their own password, set ${login.passwordChangedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.` : "Uses their own password."} Nobody else can see it.</p>
                  )}
                  <p className="text-xs text-muted-foreground">When they change their name or email in Account settings, it updates here and in Members automatically.</p>
                </div>
              ) : (
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">Give {e.fullName} an email and temporary password to sign in with. They&apos;ll pick their own password the first time, so only they know it.</p>
              )}
            </div>
            {login?.canResetPassword && <ResetPasswordDialog slug={ctx.organization.slug} employeeId={e.id} name={e.fullName} email={login.email} organizationName={ctx.organization.name} />}
            {canCreateLogin && roles && roles.length > 0 && (
              <CreateLoginDialog slug={ctx.organization.slug} employeeId={e.id} name={e.fullName} defaultEmail={e.workEmail ?? ""} roles={roles} organizationName={ctx.organization.name}
                trigger={<Button><KeyRound />Create login</Button>} />
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Direct reports</h2>
          {e.reports.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No one reports to {e.fullName}.</p> : (
            <ul className="mt-3 grid gap-3">
              {e.reports.map((r) => (
                <li key={r.id}><Link href={`${base}/${r.id}`} className="flex items-center gap-2.5 hover:opacity-80"><Avatar name={r.name} size="sm" /><span className="grid"><span className="text-sm font-medium">{r.name}</span><span className="text-xs text-muted-foreground">{r.jobTitle ?? "—"}</span></span></Link></li>
              ))}
            </ul>
          )}
        </Card>
        {leave && (
          <Card className="p-5">
            <div className="flex items-baseline justify-between"><h2 className="text-sm font-semibold">Leave history</h2>{e.isSelf && <Link href={`${base}/leave`} className="text-sm font-medium text-primary hover:underline">Request leave</Link>}</div>
            {leave.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No leave requested yet.</p> : (
              <ul className="mt-3 grid gap-2">
                {leave.slice(0, 8).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="grid"><span className="font-medium">{LEAVE_LABELS[l.type]} · {l.days} {l.days === 1 ? "day" : "days"}</span><span className="text-xs text-muted-foreground">{longDate(l.startDate)}{l.endDate !== l.startDate ? ` – ${longDate(l.endDate)}` : ""}</span></span>
                    <LeaveStatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

export default function EmployeePage(props: { params: Promise<{ organizationSlug: string; employeeId: string }> }) {
  return (
    <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-44" /><Skeleton className="h-64" /></div>}>
      <Profile {...props} />
    </Suspense>
  );
}
