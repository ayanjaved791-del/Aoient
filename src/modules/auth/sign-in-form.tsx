"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { safeNextPath, signInSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { describeAuthError } from "./auth-error";
import { isLocalAuth, LocalAuthError, localSignIn } from "@/lib/local-auth";

type Values = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [error, setError] = useState<{ message: string; unverifiedEmail?: string } | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setError(null);
    if (isLocalAuth) {
      try {
        await localSignIn(values);
        router.replace("/home");
      } catch (e) {
        setError({ message: e instanceof LocalAuthError ? e.message : "We couldn't sign you in." });
      }
      return;
    }
    const { error } = await authClient.signIn.email({ email: values.email, password: values.password, callbackURL: next });
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setError({ message: "Verify your email to continue. We've sent you a new verification link.", unverifiedEmail: values.email });
      } else if (error.status === 401) {
        setError({ message: "Incorrect email or password." });
      } else {
        setError({ message: describeAuthError(error, "We couldn't sign you in.") });
      }
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {params.get("reset") === "success" && <Alert tone="success" title="Password updated">Sign in with your new password.</Alert>}
      {params.get("verified") === "1" && <Alert tone="success" title="Email verified">You can now sign in.</Alert>}
      {error && (
        <Alert tone="danger" title={error.message}>
          {error.unverifiedEmail && (
            <Link className="font-medium text-primary hover:underline" href={`/verify-email?email=${encodeURIComponent(error.unverifiedEmail)}`}>
              Didn&apos;t get it?
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
      {!isLocalAuth && (
        <div className="-mt-1 flex justify-end">
          <Link href="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">Forgot password?</Link>
        </div>
      )}
      <Button type="submit" loading={isSubmitting} className="w-full">Sign in</Button>
    </form>
  );
}
