"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CURRENCIES } from "@/lib/formatting/options";
import { createEmployeeAction, updateEmployeeAction } from "./actions";

export interface EmployeeFormValues {
  fullName: string; workEmail: string; phone: string; jobTitle: string; employeeCode: string;
  departmentId: string; managerId: string; memberId: string; employmentType: string; location: string; startDate: string;
  dateOfBirth: string; personalEmail: string; homeAddress: string; emergencyContactName: string; emergencyContactPhone: string;
  salaryAmount: string; salaryCurrency: string; salaryPeriod: string;
}

export const EMPTY_EMPLOYEE: EmployeeFormValues = {
  fullName: "", workEmail: "", phone: "", jobTitle: "", employeeCode: "", departmentId: "", managerId: "", memberId: "",
  employmentType: "full_time", location: "", startDate: "", dateOfBirth: "", personalEmail: "", homeAddress: "",
  emergencyContactName: "", emergencyContactPhone: "", salaryAmount: "", salaryCurrency: "USD", salaryPeriod: "monthly",
};

import { EMPLOYMENT_LABELS } from "./labels";

type Opt = { id: string; name: string; email?: string };

/**
 * Add or edit an employee. Private details are only shown (and sent) when the
 * viewer's role can see them; the server checks that again.
 */
export function EmployeeDialog({
  slug, trigger, employeeId, initial = EMPTY_EMPLOYEE, departments, managers, members, canSensitive, defaultCurrency,
}: {
  slug: string; trigger: ReactNode; employeeId?: string; initial?: EmployeeFormValues;
  departments: Opt[]; managers: Opt[]; members: Opt[] | null; canSensitive: boolean; defaultCurrency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<EmployeeFormValues>({ ...initial, salaryCurrency: initial.salaryCurrency || defaultCurrency });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof EmployeeFormValues) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  const text = (k: keyof EmployeeFormValues) => ({ value: v[k], onChange: (e: { target: { value: string } }) => set(k)(e.target.value) });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({}); setFormError(null);
    if (v.fullName.trim().length < 2) return setErrors({ fullName: "Enter their full name" });
    const { dateOfBirth, personalEmail, homeAddress, emergencyContactName, emergencyContactPhone, salaryAmount, salaryCurrency, salaryPeriod, ...basic } = v;
    const payload = canSensitive
      ? { ...basic, dateOfBirth, personalEmail, homeAddress, emergencyContactName, emergencyContactPhone, salaryAmount, salaryCurrency: salaryAmount ? salaryCurrency : "", salaryPeriod: salaryAmount ? salaryPeriod : null }
      : basic;
    setSaving(true);
    const res = employeeId ? await updateEmployeeAction(slug, employeeId, payload) : await createEmployeeAction(slug, payload);
    setSaving(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(Object.fromEntries(Object.entries(res.error.fields).map(([k, m]) => [k, m[0]])));
      setFormError(res.error.message);
      return;
    }
    toast.success(employeeId ? "Employee updated" : `${v.fullName} added to People`);
    setOpen(false);
    if (!employeeId && res.data && typeof res.data === "object" && "id" in res.data) router.push(`/${slug}/people/${(res.data as { id: string }).id}`);
    else if (!employeeId) setV({ ...EMPTY_EMPLOYEE, salaryCurrency: defaultCurrency });
  }

  const none = { value: "", label: "None" };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV({ ...initial, salaryCurrency: initial.salaryCurrency || defaultCurrency }); setErrors({}); setFormError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl scroll-thin">
        <DialogHeader>
          <DialogTitle>{employeeId ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>Work details are visible to everyone who can view People. Private details are only for HR and the person themselves.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-5">
          {formError && <Alert tone="danger" title={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="emp-name" label="Full name" error={errors.fullName}><Input autoFocus {...text("fullName")} maxLength={120} /></Field>
            <Field id="emp-title" label="Job title" error={errors.jobTitle}><Input placeholder="e.g. Nurse, Designer" {...text("jobTitle")} maxLength={80} /></Field>
            <Field id="emp-email" label="Work email" error={errors.workEmail}><Input type="email" {...text("workEmail")} /></Field>
            <Field id="emp-phone" label="Phone" error={errors.phone}><Input type="tel" {...text("phone")} maxLength={40} /></Field>
            <Field id="emp-dept" label="Department" error={errors.departmentId}>
              <Select value={v.departmentId} onValueChange={set("departmentId")} options={[none, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
            </Field>
            <Field id="emp-mgr" label="Manager" error={errors.managerId}>
              <Select value={v.managerId} onValueChange={set("managerId")} options={[none, ...managers.filter((m) => m.id !== employeeId).map((m) => ({ value: m.id, label: m.name }))]} />
            </Field>
            <Field id="emp-type" label="Employment type" error={errors.employmentType}>
              <Select value={v.employmentType} onValueChange={set("employmentType")} options={Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field id="emp-start" label="Start date" error={errors.startDate}><Input type="date" {...text("startDate")} /></Field>
            <Field id="emp-loc" label="Location" error={errors.location}><Input placeholder="e.g. Lahore office, Remote" {...text("location")} maxLength={80} /></Field>
            <Field id="emp-code" label="Employee ID (optional)" error={errors.employeeCode}><Input {...text("employeeCode")} maxLength={32} /></Field>
            {members && (
              <Field id="emp-member" label="Workspace account" hint="Link to a member so they can see their profile and request leave." error={errors.memberId} className="sm:col-span-2">
                <Select value={v.memberId} onValueChange={set("memberId")} options={[{ value: "", label: "Not linked" }, ...members.map((m) => ({ value: m.id, label: m.email ? `${m.name} · ${m.email}` : m.name, keywords: m.email }))]} />
              </Field>
            )}
          </div>

          {canSensitive && (
            <fieldset className="grid gap-4 rounded-xl border border-dashed border-border p-4">
              <legend className="flex items-center gap-1.5 px-1 text-sm font-medium"><Lock className="size-3.5 text-warning" aria-hidden />Private details</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="emp-salary" label="Salary" error={errors.salaryAmount}><Input inputMode="decimal" placeholder="0.00" {...text("salaryAmount")} /></Field>
                <Field id="emp-cur" label="Currency" error={errors.salaryCurrency}>
                  <Select value={v.salaryCurrency} onValueChange={set("salaryCurrency")} searchable options={[...new Set([defaultCurrency, ...CURRENCIES])].map((c) => ({ value: c, label: c }))} />
                </Field>
                <Field id="emp-period" label="Per" error={errors.salaryPeriod}>
                  <Select value={v.salaryPeriod} onValueChange={set("salaryPeriod")} options={[{ value: "monthly", label: "Month" }, { value: "yearly", label: "Year" }, { value: "hourly", label: "Hour" }]} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="emp-dob" label="Date of birth" error={errors.dateOfBirth}><Input type="date" {...text("dateOfBirth")} /></Field>
                <Field id="emp-pemail" label="Personal email" error={errors.personalEmail}><Input type="email" {...text("personalEmail")} /></Field>
                <Field id="emp-ecn" label="Emergency contact" error={errors.emergencyContactName}><Input {...text("emergencyContactName")} maxLength={120} /></Field>
                <Field id="emp-ecp" label="Emergency phone" error={errors.emergencyContactPhone}><Input type="tel" {...text("emergencyContactPhone")} maxLength={40} /></Field>
                <Field id="emp-addr" label="Home address" error={errors.homeAddress} className="sm:col-span-2"><Textarea rows={2} {...text("homeAddress")} maxLength={240} /></Field>
              </div>
            </fieldset>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{employeeId ? "Save changes" : "Add employee"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
