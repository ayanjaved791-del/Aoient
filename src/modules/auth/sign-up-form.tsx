"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath, signUpSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { describeAuthError } from "./auth-error";
import { SupabaseMissingNotice } from "./supabase-missing-notice";
import { OAuthButtons } from "./oauth-buttons";
import { CaptchaBox, useCaptcha } from "@/components/captcha/turnstile";

type Values = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [serverError, setServerError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: params.get("email") ?? "", password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const captcha = useCaptcha();

  if (!isSupabaseConfigured) return <SupabaseMissingNotice />;

  async function onSubmit(values: Values) {
    setServerError(null);
    setExisting(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { name: values.name },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
        captchaToken: captcha.token,
      },
    });
    captcha.reset();
    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") setExisting(values.email);
      else setServerError(describeAuthError(error, "We couldn't create your account."));
      return;
    }
    // Supabase doesn't send another email for an address that already has an
    // account; it answers with a user that has no sign-in methods instead.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setExisting(values.email);
      return;
    }
    // With email confirmation off in Supabase, a session is returned straight away.
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(values.email)}&next=${encodeURIComponent(next)}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <OAuthButtons next={next} />
      {serverError && <Alert tone="danger" title={serverError} />}
      {existing && (
        <Alert tone="info" title="You already have an account with this email.">
          <Link className="font-medium text-primary hover:underline" href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in instead</Link>
          {" "}or{" "}
          <Link className="font-medium text-primary hover:underline" href="/forgot-password">reset your password</Link>.
        </Alert>
      )}
      <Field id="name" label="Full name" error={errors.name?.message}>
        <Input autoComplete="name" autoFocus {...form.register("name")} />
      </Field>
      <Field id="email" label="Work email" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters." error={errors.password?.message}>
        <Input type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <CaptchaBox captcha={captcha} />
      <Button type="submit" loading={isSubmitting} disabled={!captcha.ready} className="w-full">Create account</Button>
    </form>
  );
}
