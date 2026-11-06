"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SupabaseMissingNotice } from "./supabase-missing-notice";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type Values = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [state, setState] = useState<"idle" | "sent" | "limited">("idle");
  const form = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });
    // Generic response whether or not the account exists (no account enumeration).
    setState(error?.status === 429 ? "limited" : "sent");
  }

  if (!isSupabaseConfigured) return <SupabaseMissingNotice />;

  if (state === "sent") {
    return <Alert tone="success" title="Check your inbox">If an account exists for that address, we&apos;ve sent a link to reset your password.</Alert>;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {state === "limited" && <Alert tone="danger" title="Too many requests. Try again in a few minutes." />}
      <Field id="email" label="Work email" error={errors.email?.message}>
        <Input type="email" autoComplete="email" autoFocus {...form.register("email")} />
      </Field>
      <Button type="submit" loading={isSubmitting} className="w-full">Send reset link</Button>
    </form>
  );
}
