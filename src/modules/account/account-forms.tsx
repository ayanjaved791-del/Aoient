"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { changeEmailAction, changeNameAction, changePasswordAction } from "./actions";

type Errors = Record<string, string>;
const toErrors = (fields?: Record<string, string[]>): Errors => Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, v[0]]));

export function PasswordForm({ setup, next }: { setup: boolean; next: string }) {
  const router = useRouter();
  const [v, setV] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({}); setFormError(null); setSaving(true);
    const res = await changePasswordAction(v);
    setSaving(false);
    if (!res.ok) { setErrors(toErrors(res.error.fields)); if (!res.error.fields) setFormError(res.error.message); return; }
    toast.success("Password updated. Only you know it now.");
    setV({ currentPassword: "", password: "", confirmPassword: "" });
    if (setup) router.replace(next); else router.refresh();
  }
  const type = show ? "text" : "password";
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {formError && <Alert tone="danger" title={formError} />}
      <Field id="current-password" label={setup ? "Temporary password (from your admin)" : "Current password"} error={errors.currentPassword}>
        <Input type={type} autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} />
      </Field>
      <Field id="new-password" label="New password" hint="At least 10 characters. Your admin will not be able to see it." error={errors.password}>
        <Input type={type} autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
      </Field>
      <Field id="confirm-password" label="Confirm new password" error={errors.confirmPassword}>
        <Input type={type} autoComplete="new-password" value={v.confirmPassword} onChange={(e) => setV({ ...v, confirmPassword: e.target.value })} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}{show ? "Hide passwords" : "Show passwords"}
        </button>
        <Button type="submit" loading={saving}><KeyRound />{setup ? "Set my password" : "Update password"}</Button>
      </div>
    </form>
  );
}

export function NameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setSaving(true);
    const res = await changeNameAction({ name });
    setSaving(false);
    if (!res.ok) return setError(res.error.fields?.name?.[0] ?? res.error.message);
    toast.success("Name updated"); router.refresh();
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field id="account-name" label="Full name" error={error ?? undefined} className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
      <Button type="submit" variant="secondary" loading={saving} disabled={name.trim() === initial}>Save</Button>
    </form>
  );
}

export function EmailForm({ initial }: { initial: string }) {
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setInfo(null); setSaving(true);
    const res = await changeEmailAction({ email });
    setSaving(false);
    if (!res.ok) return setError(res.error.fields?.email?.[0] ?? res.error.message);
    setInfo(res.data.pending ? `We sent a confirmation link to ${email}. Your sign-in email changes once you click it.` : "Email updated.");
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      {info && <Alert tone="info" title={info} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id="account-email" label="Sign-in email" error={error ?? undefined} className="flex-1"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Button type="submit" variant="secondary" loading={saving} disabled={email.trim().toLowerCase() === initial.toLowerCase()}>Change email</Button>
      </div>
    </form>
  );
}
