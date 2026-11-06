import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/modules/auth/auth-card";
import { LocalModeNotice } from "@/modules/auth/local-mode-notice";
import { isLocalAuth } from "@/lib/local-auth";
import { ForgotPasswordForm } from "@/modules/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  if (isLocalAuth) return <LocalModeNotice title="Reset your password" />;
  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email you use for Aoient and we'll send you a reset link."
      footer={<Link href="/sign-in" className="font-medium text-primary hover:underline">Back to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
