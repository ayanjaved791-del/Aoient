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
import { explainSignInFailureAction } from "./actions";
import { SupabaseMissingNotice } from "./supabase-missing-notice";
import { OAuthButtons } from "./oauth-buttons";
import { CaptchaBox, useCaptcha } from "@/components/captcha/turnstile";

type Values = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/organizations");
  const [error, setError] = useState<{ message: string; detail?: "no-account" | "wrong-password" | "unconfirmed" | "deactivated"; email?: string } | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const captcha = useCaptcha();
  const { errors, isSubmitting } = form.formState;

  if (!isSupabaseConfigured) return <SupabaseMissingNotice />;

  async function onSubmit(values: Values) {
    setError(null);
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email: values.email, password: values.password, options: { captchaToken: captcha.token } });
    captcha.reset();
    if (error) {
      if (error.code === "email_not_confirmed") {
        setError({ message: describeAuthError(error, "We couldn't sign you in."), detail: "unconfirmed", email: values.email });
        return;
      }
      if (error.code === "invalid_credentials") {
        // Say whether the email has an account, so people know to sign up instead.
        const reason = await explainSignInFailureAction(values.email).catch(() => "unknown" as const);
        const messages = {
          "no-account": "There's no Aoient account for this email.",
          "wrong-password": "That password isn't right for this account.",
          unconfirmed: "Verify your email to continue. Check your inbox for the link.",
          deactivated: "This account has been turned off.",
          unknown: "Incorrect email or password.",
        } as const;
        setError({ message: messages[reason], detail: reason === "unknown" ? undefined : reason, email: values.email });
        return;
      }
      setError({ message: describeAuthError(error, "We couldn't sign you in.") });
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {params.get("error") === "oauth" && <Alert tone="danger" title="Google sign-in didn't complete.">Try again, or sign in with your email and password.</Alert>}
      <OAuthButtons next={next} />
      {params.get("reset") === "success" && <Alert tone="success" title="Password updated">Sign in with your new password.</Alert>}
      {error && (
        <Alert tone={error.detail === "no-account" ? "info" : "danger"} title={error.message}>
          {error.detail === "unconfirmed" && error.email && (
            <Link className="font-medium text-primary hover:underline" href={`/verify-email?email=${encodeURIComponent(error.email)}&next=${encodeURIComponent(next)}`}>
              Send a new link
            </Link>
          )}
          {error.detail === "no-account" && error.email && (
            <>
              Check the spelling, or{" "}
              <Link className="font-medium text-primary hover:underline" href={`/sign-up?email=${encodeURIComponent(error.email)}&next=${encodeURIComponent(next)}`}>
                create an account
              </Link>
              .
            </>
          )}
          {error.detail === "wrong-password" && (
            <>
              Try again, <Link className="font-medium text-primary hover:underline" href="/forgot-password">reset your password</Link>, or use Continue with Google if you signed up with Google.
            </>
          )}
          {error.detail === "deactivated" && <>Contact your workspace admin if you think this is a mistake.</>}
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
      <CaptchaBox captcha={captcha} />
      <Button type="submit" loading={isSubmitting} disabled={!captcha.ready} className="w-full">Sign in</Button>
    </form>
  );
}
