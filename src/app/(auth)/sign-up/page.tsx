import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/modules/auth/auth-card";
import { AuthSwitchLink } from "@/modules/auth/auth-switch-link";
import { SignUpForm } from "@/modules/auth/sign-up-form";
import { FormSkeleton } from "@/modules/auth/form-skeleton";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Set up Aoient for your business in a minute."
      footer={<>Already have an account? <Suspense fallback={<Link href="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link>}><AuthSwitchLink to="/sign-in">Sign in</AuthSwitchLink></Suspense></>}
    >
      <Suspense fallback={<FormSkeleton fields={4} />}><SignUpForm /></Suspense>
    </AuthCard>
  );
}
