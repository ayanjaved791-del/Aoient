import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/modules/auth/auth-card";
import { LocalModeNotice } from "@/modules/auth/local-mode-notice";
import { isLocalAuth } from "@/lib/local-auth";
import { ResetPasswordForm } from "@/modules/auth/reset-password-form";
import { FormSkeleton } from "@/modules/auth/form-skeleton";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  if (isLocalAuth) return <LocalModeNotice title="Choose a new password" />;
  return (
    <AuthCard title="Choose a new password">
      <Suspense fallback={<FormSkeleton />}><ResetPasswordForm /></Suspense>
    </AuthCard>
  );
}
