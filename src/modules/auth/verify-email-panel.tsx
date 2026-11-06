"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function VerifyEmailPanel() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const next = safeNextPath(params.get("next"));
  const linkError = params.get("error");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setStatus("sending");
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: next });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="grid gap-4">
      {linkError && <Alert tone="danger" title="That verification link is invalid or has expired.">Request a new link below.</Alert>}
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary"><MailCheck className="size-5" aria-hidden /></span>
        <p className="text-sm text-secondary-foreground">
          {email ? <>We sent a verification link to <span className="font-medium text-foreground">{email}</span>.</> : "We sent you a verification link."}{" "}
          Open it to activate your account. The link expires in 1 hour.
        </p>
      </div>
      {status === "sent" && <Alert tone="success" title="A new link is on its way." />}
      {status === "error" && <Alert tone="danger" title="We couldn't send a new link right now. Try again in a few minutes." />}
      {email && (
        <Button variant="secondary" onClick={resend} loading={status === "sending"} disabled={status === "sent"}>
          Resend verification email
        </Button>
      )}
    </div>
  );
}
