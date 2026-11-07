"use client";
import { useRef, useState } from "react";
import { Check, Copy, Link2, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface InviteLink {
  email: string;
  roleName: string;
  url: string;
  expiresAt: string;
  delivered: boolean;
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });

/** Shown right after an invitation is created: the join link, ready to copy or share. */
export function InviteLinkPanel({ invite, organizationName }: { invite: InviteLink; organizationName: string }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const expires = dateFmt.format(new Date(invite.expiresAt));
  const message = `You're invited to join ${organizationName} on Aoient as ${invite.roleName}. Sign up or sign in with ${invite.email} and open this link (valid until ${expires}):\n${invite.url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.url);
    } catch {
      // Clipboard API blocked (e.g. insecure context): select the text so Ctrl/Cmd+C works.
      inputRef.current?.select();
      toast.info("Press Ctrl+C (or ⌘C) to copy the selected link.");
      return;
    }
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border bg-surface-muted/50 px-4 py-3 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="min-w-0 truncate font-medium">{invite.email}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd className="font-medium">{invite.roleName}</dd>
        <dt className="text-muted-foreground">Valid until</dt>
        <dd className="font-medium">{expires}</dd>
      </dl>

      <div className="grid gap-1.5">
        <label htmlFor="invite-link" className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="size-4 text-primary" aria-hidden />Invite link
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="invite-link"
            readOnly
            value={invite.url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-surface px-3 font-mono text-xs text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="button" onClick={copy} className={cn("w-24", copied && "bg-success hover:bg-success")}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle />WhatsApp
          </a>
        </Button>
        <Button variant="secondary" asChild>
          <a href={`mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent(`Join ${organizationName} on Aoient`)}&body=${encodeURIComponent(message)}`}>
            <Mail />Email it
          </a>
        </Button>
      </div>

      <p className="flex gap-2 rounded-lg bg-primary-subtle px-3 py-2.5 text-xs leading-relaxed text-primary">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          {invite.delivered ? "We also emailed this link. " : "Aoient doesn't send emails yet, so share this link yourself. "}
          It works once, only for {invite.email}, and only until {expires}. Copy it now: for security it can&apos;t be shown again, but you can make a new one from Pending invitations.
        </span>
      </p>
    </div>
  );
}
