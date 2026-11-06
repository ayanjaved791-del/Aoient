"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function VerifyEmailPanel() {
  const params = useSearchParams();
  const knownEmail = params.get("email") ?? "";
  const next = safeNextPath(params.get("next"));
  const linkError = params.get("error");
  const [email, setEmail] = useState(knownEmail);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    const { error } = await getSupabaseBrowserClient().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="grid gap-4">
      {linkError && (
        <Alert tone="danger" title={linkError === "otp_expired" ? "That email link has expired or was already used." : "That email link is invalid or has expired."}>
          Request a new verification link below. If this was a password reset link,{" "}
          <Link href="/forgot-password" className="font-medium underline">request a new reset link</Link> instead.
        </Alert>
      )}
      {!linkError && (
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary"><MailCheck className="size-5" aria-hidden /></span>
          <p className="text-sm text-secondary-foreground">
            {knownEmail ? <>We sent a verification link to <span className="font-medium text-foreground">{knownEmail}</span>.</> : "We sent you a verification link."}{" "}
            Open it to activate your account. Only the newest link works.
          </p>
        </div>
      )}
      {status === "sent" && <Alert tone="success" title="A new link is on its way." />}
      {status === "error" && <Alert tone="danger" title="We couldn't send a new link right now. Try again in a few minutes." />}
      {isSupabaseConfigured && (
        <form onSubmit={resend} className="grid gap-3">
          {!knownEmail && (
            <Field id="resend-email" label="Email">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          )}
          <Button type="submit" variant="secondary" loading={status === "sending"} disabled={status === "sent" || !email.trim()}>
            Resend verification email
          </Button>
        </form>
      )}
    </div>
  );
}
