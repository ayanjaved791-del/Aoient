import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/modules/auth/auth-card";
import { AuthSwitchLink } from "@/modules/auth/auth-switch-link";
import { SignInForm } from "@/modules/auth/sign-in-form";
import { FormSkeleton } from "@/modules/auth/form-skeleton";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in to Aoient"
      description="Welcome back. Enter your details to continue."
      footer={<>New to Aoient? <Suspense fallback={<Link href="/sign-up" className="font-medium text-primary hover:underline">Create an account</Link>}><AuthSwitchLink to="/sign-up">Create an account</AuthSwitchLink></Suspense></>}
    >
      <Suspense fallback={<FormSkeleton />}><SignInForm /></Suspense>
    </AuthCard>
  );
}
