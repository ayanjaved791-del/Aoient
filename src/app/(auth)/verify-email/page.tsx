import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/modules/auth/auth-card";
import { LocalModeNotice } from "@/modules/auth/local-mode-notice";
import { isLocalAuth } from "@/lib/local-auth";
import { VerifyEmailPanel } from "@/modules/auth/verify-email-panel";
import { FormSkeleton } from "@/modules/auth/form-skeleton";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  if (isLocalAuth) return <LocalModeNotice title="Check your email" />;
  return (
    <AuthCard title="Check your email" footer={<Link href="/sign-in" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
      <Suspense fallback={<FormSkeleton fields={1} />}><VerifyEmailPanel /></Suspense>
    </AuthCard>
  );
}
