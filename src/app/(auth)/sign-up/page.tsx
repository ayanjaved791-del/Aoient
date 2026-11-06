import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/modules/auth/auth-card";
import { SignUpForm } from "@/modules/auth/sign-up-form";
import { FormSkeleton } from "@/modules/auth/form-skeleton";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Set up Aoient for your business. You'll verify your email next."
      footer={<>Already have an account? <Link href="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link></>}
    >
      <Suspense fallback={<FormSkeleton fields={4} />}><SignUpForm /></Suspense>
    </AuthCard>
  );
}
