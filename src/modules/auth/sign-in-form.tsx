"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath, signInSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { describeAuthError } from "./auth-error";
import { SupabaseMissingNotice } from "./supabase-missing-notice";

type Values = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/organizations");
  const [error, setError] = useState<{ message: string; unverifiedEmail?: string } | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  if (!isSupabaseConfigured) return <SupabaseMissingNotice />;

  async function onSubmit(values: Values) {
    setError(null);
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email: values.email, password: values.password });
    if (error) {
      setError({
        message: describeAuthError(error, "We couldn't sign you in."),
        unverifiedEmail: error.code === "email_not_confirmed" ? values.email : undefined,
      });
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {params.get("reset") === "success" && <Alert tone="success" title="Password updated">Sign in with your new password.</Alert>}
      {error && (
        <Alert tone="danger" title={error.message}>
          {error.unverifiedEmail && (
            <Link
              className="font-medium text-primary hover:underline"
              href={`/verify-email?email=${encodeURIComponent(error.unverifiedEmail)}&next=${encodeURIComponent(next)}`}
            >
              Send a new link
            </Link>
          )}
        </Alert>
      )}
      <Field id="email" label="Work email" error={errors.email?.message}>
        <Input type="email" autoComplete="email" autoFocus {...form.register("email")} />
      </Field>
      <Field id="password" label="Password" error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...form.register("password")} />
      </Field>
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" loading={isSubmitting} className="w-full">Sign in</Button>
    </form>
  );
}
