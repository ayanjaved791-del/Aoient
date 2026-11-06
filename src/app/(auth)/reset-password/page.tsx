import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/modules/auth/auth-card";
import { ResetPasswordForm } from "@/modules/auth/reset-password-form";
import { FormSkeleton } from "@/modules/auth/form-skeleton";
import { SupabaseMissingNotice } from "@/modules/auth/supabase-missing-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/server/auth/supabase";

export const metadata: Metadata = { title: "Choose a new password" };

async function ResetPasswordGate() {
  // The recovery link (via /auth/confirm) signs the visitor in; without that session there is nothing to reset.
  const supabase = await getSupabaseServerClient();
  const claims = supabase ? (await supabase.auth.getClaims()).data?.claims : null;
  return <ResetPasswordForm hasRecoverySession={Boolean(claims)} />;
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      {isSupabaseConfigured ? (
        <Suspense fallback={<FormSkeleton />}><ResetPasswordGate /></Suspense>
      ) : (
        <SupabaseMissingNotice />
      )}
    </AuthCard>
  );
}
