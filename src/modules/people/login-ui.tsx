"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, MessageCircle, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createEmployeeLoginAction, resetEmployeePasswordAction } from "./actions";

/** 14 readable characters (no 0/O, 1/l/I) from the browser's secure random source. */
export function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(true);
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="pr-9 font-mono" autoComplete="new-password" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <Button type="button" variant="secondary" onClick={() => onChange(generatePassword())}><RefreshCw />Generate</Button>
    </div>
  );
}

/** Shown once after a login is created or a temporary password set: hand these to the employee. */
export function CredentialsPanel({ name, email, password, organizationName }: { name: string; email: string; password: string; organizationName: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/sign-in` : "/sign-in";
  const message = `Hi ${name.split(" ")[0]}, your ${organizationName} login for Aoient:\nSign in: ${url}\nEmail: ${email}\nTemporary password: ${password}\nYou'll choose your own password the first time you sign in.`;
  async function copy() {
    try { await navigator.clipboard.writeText(message); setCopied(true); toast.success("Login details copied"); setTimeout(() => setCopied(false), 2000); }
    catch { toast.info("Select the details and copy them manually."); }
  }
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-border bg-surface-muted/50 p-4 text-sm">
        <dt className="text-muted-foreground">Sign in at</dt><dd className="min-w-0 truncate font-medium">{url}</dd>
        <dt className="text-muted-foreground">Email</dt><dd className="min-w-0 truncate font-medium">{email}</dd>
        <dt className="text-muted-foreground">Password</dt><dd className="font-mono font-semibold tracking-wide">{password}</dd>
      </dl>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" onClick={copy} className={copied ? "bg-success hover:bg-success" : undefined}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy details"}</Button>
        <Button type="button" variant="secondary" asChild><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />WhatsApp</a></Button>
      </div>
      <p className="flex gap-2 rounded-lg bg-warning-subtle px-3 py-2.5 text-xs leading-relaxed text-warning">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>This password is shown only now and isn&apos;t stored in readable form. {name.split(" ")[0]} must choose a new one at first sign-in, after which only they know it.</span>
      </p>
    </div>
  );
}

export function CreateLoginDialog({ slug, employeeId, name, defaultEmail, roles, organizationName, trigger }: {
  slug: string; employeeId: string; name: string; defaultEmail: string; roles: { id: string; name: string; description: string | null }[]; organizationName: string; trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles.find((r) => r.name === "Employee")?.id ?? roles[0]?.id ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<null | { email: string; password: string }>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErrors({}); setFormError(null); setSaving(true);
    const res = await createEmployeeLoginAction(slug, employeeId, { email, password, roleId });
    setSaving(false);
    if (!res.ok) { setErrors(Object.fromEntries(Object.entries(res.error.fields ?? {}).map(([k, v]) => [k, v[0]]))); setFormError(res.error.message); return; }
    setDone({ email: res.data.email, password });
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setDone(null); setPassword(generatePassword()); setErrors({}); setFormError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {done ? (
          <>
            <DialogHeader><DialogTitle>Login created for {name}</DialogTitle><DialogDescription>Give them these details. They&apos;ll be asked to choose their own password.</DialogDescription></DialogHeader>
            <CredentialsPanel name={name} email={done.email} password={done.password} organizationName={organizationName} />
            <DialogFooter><Button onClick={() => setOpen(false)}>Done</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>Create a login for {name}</DialogTitle><DialogDescription>They sign in with this email and a temporary password, then set their own.</DialogDescription></DialogHeader>
            <form onSubmit={submit} noValidate className="grid gap-4">
              {formError && <Alert tone="danger" title={formError} />}
              <Field id="login-email" label="Sign-in email" error={errors.email}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field id="login-password" label="Temporary password" hint="At least 10 characters." error={errors.password}><PasswordInput id="login-password" value={password} onChange={setPassword} /></Field>
              <Field id="login-role" label="Role" hint={roles.find((r) => r.id === roleId)?.description ?? undefined} error={errors.roleId}>
                <Select value={roleId} onValueChange={setRoleId} options={roles.map((r) => ({ value: r.id, label: r.name, description: r.description }))} />
              </Field>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" loading={saving}><UserPlus />Create login</Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ResetPasswordDialog({ slug, employeeId, name, email, organizationName }: { slug: string; employeeId: string; name: string; email: string; organizationName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setSaving(true);
    const res = await resetEmployeePasswordAction(slug, employeeId, { password });
    setSaving(false);
    if (!res.ok) return setError(res.error.fields?.password?.[0] ?? res.error.message);
    setDone(true);
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setDone(false); setPassword(generatePassword()); setError(null); } }}>
      <DialogTrigger asChild><Button variant="secondary" size="sm"><KeyRound />Set temporary password</Button></DialogTrigger>
      <DialogContent>
        {done ? (
          <>
            <DialogHeader><DialogTitle>New temporary password for {name}</DialogTitle><DialogDescription>Their old password no longer works.</DialogDescription></DialogHeader>
            <CredentialsPanel name={name} email={email} password={password} organizationName={organizationName} />
            <DialogFooter><Button onClick={() => setOpen(false)}>Done</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>Set a temporary password?</DialogTitle><DialogDescription>Use this if {name} forgot their password. Their current password stops working and they&apos;ll choose a new one at next sign-in.</DialogDescription></DialogHeader>
            <form onSubmit={submit} noValidate className="grid gap-4">
              {error && <Alert tone="danger" title={error} />}
              <Field id="reset-password" label="Temporary password"><PasswordInput id="reset-password" value={password} onChange={setPassword} /></Field>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" loading={saving}>Set password</Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
