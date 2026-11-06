"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { safeNextPath, signUpSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { describeAuthError } from "./auth-error";

type Values = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: params.get("email") ?? "", password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setServerError(null);
    const { error } = await authClient.signUp.email({ name: values.name, email: values.email, password: values.password, callbackURL: next });
    if (error) {
      setServerError(describeAuthError(error, "We couldn't create your account."));
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(values.email)}&next=${encodeURIComponent(next)}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {serverError && <Alert tone="danger" title={serverError} />}
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
      <Button type="submit" loading={isSubmitting} className="w-full">Create account</Button>
    </form>
  );
}
