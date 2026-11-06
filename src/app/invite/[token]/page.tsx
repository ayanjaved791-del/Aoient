import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/server/auth/session";
import { getInvitationPreview } from "@/server/organizations/invitations";
import { AuthCard } from "@/modules/auth/auth-card";
import { AcceptInvitationButton } from "@/modules/organization/accept-invitation";

export const metadata: Metadata = { title: "Join organization", robots: { index: false } };

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, user] = await Promise.all([getInvitationPreview(token), getSessionUser()]);

  if (preview.state === "invalid") {
    return (
      <AuthCard title="Invitation unavailable">
        <Alert tone="warning" title="This invitation is invalid, has expired, or was already used.">
          Ask the person who invited you to send a new invitation.
        </Alert>
      </AuthCard>
    );
  }

  const next = `/invite/${token}`;
  const emailMatches = user && user.email.toLowerCase() === preview.email.toLowerCase();

  return (
    <AuthCard
      title={`Join ${preview.organizationName}`}
      description={<>{preview.inviterName ?? "A teammate"} invited <span className="font-medium text-foreground">{preview.email}</span> to join as <span className="font-medium text-foreground">{preview.roleName}</span>.</>}
    >
      {!user ? (
        <div className="grid gap-3">
          <p className="text-sm text-secondary-foreground">Sign in or create an account with {preview.email} to accept.</p>
          <Button asChild><Link href={`/sign-up?next=${encodeURIComponent(next)}&email=${encodeURIComponent(preview.email)}`}>Create account</Link></Button>
          <Button variant="secondary" asChild><Link href={`/sign-in?next=${encodeURIComponent(next)}`}>I already have an account</Link></Button>
        </div>
      ) : !emailMatches ? (
        <Alert tone="warning" title={`You're signed in as ${user.email}.`}>
          This invitation was sent to {preview.email}. Sign out and sign in with that address to accept it.
        </Alert>
      ) : (
        <AcceptInvitationButton token={token} />
      )}
    </AuthCard>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-5 sm:px-8"><Link href="/" aria-label="Aoient home"><Logo /></Link></header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[420px]">
          <Suspense fallback={<div className="grid gap-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-36 w-full" /></div>}>
            <Invitation params={params} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
