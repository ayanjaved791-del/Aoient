import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/modules/auth/auth-card";
import { VerifyEmailPanel } from "@/modules/auth/verify-email-panel";
import { FormSkeleton } from "@/modules/auth/form-skeleton";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Check your email" footer={<Link href="/sign-in" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
      <Suspense fallback={<FormSkeleton fields={1} />}><VerifyEmailPanel /></Suspense>
    </AuthCard>
  );
}
