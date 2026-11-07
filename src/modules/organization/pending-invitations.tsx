"use client";
import { useState } from "react";
import { Link2, MailX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renewInvitationAction, revokeInvitationAction } from "./actions";
import { InviteLinkPanel, type InviteLink } from "./invite-link-panel";

export interface InvitationVM { id: string; email: string; roleName: string; status: "pending" | "expired"; expiresAt: string; invitedByName: string | null }

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function PendingInvitations({ slug, organizationName, invitations, canRevoke }: { slug: string; organizationName: string; invitations: InvitationVM[]; canRevoke: boolean }) {
  const [link, setLink] = useState<InviteLink | null>(null);
  const [renewing, setRenewing] = useState<string | null>(null);

  async function renew(id: string) {
    setRenewing(id);
    const res = await renewInvitationAction(slug, id);
    setRenewing(null);
    if (!res.ok) { toast.error(res.error.message); return; }
    setLink(res.data);
  }

  return (
    <>
    <Dialog open={link !== null} onOpenChange={(o) => !o && setLink(null)}>
      <DialogContent>
        {link && (
          <>
            <DialogHeader>
              <DialogTitle>New invite link</DialogTitle>
              <DialogDescription>The previous link for {link.email} no longer works. Share this one instead.</DialogDescription>
            </DialogHeader>
            <InviteLinkPanel invite={link} organizationName={organizationName} />
            <DialogFooter><Button type="button" onClick={() => setLink(null)}>Done</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    {invitations.length > 0 && (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>Each link works once, only for its email address. Lost a link? Make a new one; the old one stops working.</CardDescription>
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
              <Button variant="ghost" size="sm" loading={renewing === inv.id} onClick={() => renew(inv.id)}>
                <Link2 />{inv.status === "expired" ? "Renew link" : "New link"}
              </Button>
            )}
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
    )}
    </>
  );
}
