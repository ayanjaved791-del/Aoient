"use client";
import { MailX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { revokeInvitationAction } from "./actions";

export interface InvitationVM { id: string; email: string; roleName: string; status: "pending" | "expired"; expiresAt: string; invitedByName: string | null }

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function PendingInvitations({ slug, invitations, canRevoke }: { slug: string; invitations: InvitationVM[]; canRevoke: boolean }) {
  if (invitations.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>Invitations are single-use. Re-inviting an address replaces its previous link.</CardDescription>
      </CardHeader>
      <ul className="divide-y divide-border">
        {invitations.map((inv) => (
          <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 sm:px-6">
            <div className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">{inv.email}</span>
              <span className="text-[13px] text-muted-foreground">
                {inv.roleName}{inv.invitedByName && <> · invited by {inv.invitedByName}</>} · {inv.status === "expired" ? "expired" : "expires"} {dateFmt.format(new Date(inv.expiresAt))}
              </span>
            </div>
            {inv.status === "expired" ? <Badge tone="warning">Expired</Badge> : <Badge tone="primary">Pending</Badge>}
            {canRevoke && (
              <ConfirmDialog
                trigger={<Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger"><MailX />Revoke</Button>}
                title="Revoke invitation?"
                description={`The link sent to ${inv.email} will stop working.`}
                confirmLabel="Revoke"
                onConfirm={async () => {
                  const res = await revokeInvitationAction(slug, inv.id);
                  if (!res.ok) { toast.error(res.error.message); return false; }
                  toast.success("Invitation revoked");
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
