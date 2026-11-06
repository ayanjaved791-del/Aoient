"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type Values = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
  const { errors, isSubmitting } = form.formState;

  if (!token || params.get("error")) {
    return (
      <Alert tone="danger" title="This reset link is invalid or has expired.">
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">Request a new link</Link>
      </Alert>
    );
  }

  async function onSubmit(values: Values) {
    setServerError(null);
    const { error } = await authClient.resetPassword({ newPassword: values.password, token: token! });
    if (error) {
      setServerError(error.status === 429 ? "Too many attempts. Try again later." : "This reset link is invalid or has expired.");
      return;
    }
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
