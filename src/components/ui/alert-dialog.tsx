"use client";
import * as React from "react";
import { AlertDialog as AD } from "radix-ui";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Confirmation for destructive actions. `onConfirm` may be async; the dialog
 * stays open with a loading button until it resolves.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<boolean | void> | boolean | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  return (
    <AD.Root open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AD.Trigger asChild>{trigger}</AD.Trigger>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <AD.Content className={cn("fixed left-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-surface p-6 shadow-lg data-[state=open]:animate-in")}>
          <div className="grid gap-1.5">
            <AD.Title className="text-lg font-semibold">{title}</AD.Title>
            <AD.Description className="text-sm text-muted-foreground">{description}</AD.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AD.Cancel asChild>
              <Button variant="secondary" disabled={pending}>Cancel</Button>
            </AD.Cancel>
            <Button
              variant={destructive ? "destructive" : "primary"}
              loading={pending}
              onClick={async () => {
                setPending(true);
                try {
                  const result = await onConfirm();
                  if (result !== false) setOpen(false);
                } finally {
                  setPending(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
