"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { describeAuthError } from "./auth-error";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type Values = z.infer<typeof resetPasswordSchema>;

/** Rendered only for a visitor who arrived through a valid recovery link (they hold a recovery session). */
export function ResetPasswordForm({ hasRecoverySession }: { hasRecoverySession: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
  const { errors, isSubmitting } = form.formState;

  if (!hasRecoverySession || params.get("error")) {
    return (
      <Alert tone="danger" title="This reset link is invalid or has expired.">
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">Request a new link</Link>
      </Alert>
    );
  }

  async function onSubmit(values: Values) {
    setServerError(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setServerError(describeAuthError(error, "We couldn't update your password."));
      return;
    }
    // Sign out everywhere (all devices, including this one) after a password change.
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/sign-in?reset=success");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {serverError && <Alert tone="danger" title={serverError} />}
      <Field id="password" label="New password" hint="At least 10 characters. You'll be signed out on other devices." error={errors.password?.message}>
        <Input type="password" autoComplete="new-password" autoFocus {...form.register("password")} />
      </Field>
      <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <Button type="submit" loading={isSubmitting} className="w-full">Update password</Button>
    </form>
  );
}
