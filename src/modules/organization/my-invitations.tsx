"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptMyInvitationAction } from "./actions";

export interface MyInvitationItem {
  id: string;
  organizationName: string;
  roleName: string;
  inviterName: string | null;
  expiresLabel: string;
}

/** Invitations sent to the signed-in person's email, with a Join button each. */
export function MyInvitations({ email, invitations }: { email: string; invitations: MyInvitationItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="motion-safe:animate-rise overflow-hidden border-primary/40 shadow-sm">
      <div className="flex items-start gap-3 border-b border-border bg-primary-subtle/60 px-5 py-4 sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Mail className="size-4" aria-hidden /></span>
        <div className="grid gap-0.5">
          <h2 className="text-base font-semibold">You&apos;ve been invited</h2>
          <p className="text-sm text-muted-foreground">
            {invitations.length === 1 ? "A team has" : "These teams have"} invited <span className="font-medium text-foreground">{email}</span>. Join to get started, no link needed.
          </p>
        </div>
      </div>
      {error && <div className="px-5 pt-4 sm:px-6"><Alert tone="danger" title={error} /></div>}
      <ul className="divide-y divide-border">
        {invitations.map((inv) => (
          <li key={inv.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-navy text-sm font-semibold text-white dark:bg-primary">{inv.organizationName.slice(0, 1).toUpperCase()}</span>
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">{inv.organizationName}</span>
              <span className="text-[13px] text-muted-foreground">
                As {inv.roleName}{inv.inviterName ? ` · invited by ${inv.inviterName}` : ""} · expires {inv.expiresLabel}
              </span>
            </span>
            <Button
              className="sm:w-auto"
              loading={pendingId === inv.id}
              disabled={pendingId !== null && pendingId !== inv.id}
              onClick={async () => {
                setPendingId(inv.id);
                setError(null);
                const res = await acceptMyInvitationAction(inv.id);
                if (res.ok) router.push(`/${res.data.organizationSlug}`);
                else {
                  setError(res.error.message);
                  setPendingId(null);
                  router.refresh();
                }
              }}
            >
              Join
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
