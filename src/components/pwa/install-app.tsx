"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, MonitorDown, MoreVertical, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { promptInstall, useInstallState } from "./install-store";

function Steps({ items }: { items: { icon: typeof Share; text: React.ReactNode }[] }) {
  return (
    <ol className="grid gap-3">
      {items.map((s, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">{i + 1}</span>
          <span className="pt-1 leading-relaxed">{s.text}</span>
          <s.icon className="ml-auto mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </li>
      ))}
    </ol>
  );
}

export function IosSteps() {
  return (
    <Steps items={[
      { icon: Share, text: <>Open this site in <b>Safari</b> and tap the <b>Share</b> button.</> },
      { icon: SquarePlus, text: <>Scroll down and tap <b>Add to Home Screen</b>.</> },
      { icon: CheckCircle2, text: <>Tap <b>Add</b>. Aoient appears on your home screen like any app.</> },
    ]} />
  );
}

export function DesktopSteps() {
  return (
    <Steps items={[
      { icon: MonitorDown, text: <>In <b>Chrome</b> or <b>Edge</b>, click the install icon at the right end of the address bar.</> },
      { icon: MoreVertical, text: <>Or open the browser menu (⋮) → <b>Cast, save and share</b> → <b>Install Aoient</b> (Edge: <b>Apps</b> → <b>Install this site as an app</b>).</> },
      { icon: CheckCircle2, text: <>Aoient opens in its own window and gets a Start menu / Dock / desktop icon.</> },
    ]} />
  );
}

export function AndroidSteps() {
  return (
    <Steps items={[
      { icon: MoreVertical, text: <>In <b>Chrome</b>, tap the menu (⋮) at the top right.</> },
      { icon: SquarePlus, text: <>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</> },
      { icon: CheckCircle2, text: <>Tap <b>Install</b>. Aoient appears with your other apps.</> },
    ]} />
  );
}

export function HowToDialog({ open, onOpenChange, ios }: { open: boolean; onOpenChange: (o: boolean) => void; ios: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install Aoient</DialogTitle>
          <DialogDescription>
            {ios ? "On iPhone and iPad, apps from the web are added from Safari's Share menu." : "Your browser didn't offer one-click install here. You can install from its menu instead."}
          </DialogDescription>
        </DialogHeader>
        {ios ? <IosSteps /> : <DesktopSteps />}
        {!ios && <p className="text-xs text-muted-foreground">Firefox and Safari on Mac don&apos;t install web apps from every page; Chrome or Edge always can. On Safari 17+ for Mac use File → Add to Dock.</p>}
        <DialogFooter>
          <Button variant="secondary" asChild><Link href="/download">All platforms</Link></Button>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Installs in one click where the browser allows it; otherwise shows how to do it by hand. */
export function InstallAppButton({ className, size = "md", label = "Install app" }: { className?: string; size?: "sm" | "md" | "lg"; label?: string }) {
  const state = useInstallState();
  const [help, setHelp] = useState(false);
  if (state === "installed") {
    return (
      <span className={cn("inline-flex items-center gap-2 text-sm font-medium text-success", className)}>
        <CheckCircle2 className="size-4" aria-hidden />Aoient is installed on this device
      </span>
    );
  }
  return (
    <>
      <Button
        size={size}
        className={className}
        onClick={async () => {
          if (state === "available") {
            if (await promptInstall()) toast.success("Aoient is installing. Find it with your other apps.");
          } else setHelp(true);
        }}
      >
        <Download />{label}
      </Button>
      <HowToDialog open={help} onOpenChange={setHelp} ios={state === "ios"} />
    </>
  );
}

/**
 * Account-menu entry, hidden once installed. The how-to dialog is rendered by
 * the caller, outside the menu, so it survives the menu closing.
 */
export function InstallMenuItem({ onNeedHelp }: { onNeedHelp: (ios: boolean) => void }) {
  const state = useInstallState();
  if (state === "installed") return null;
  return (
    <DropdownMenuItem
      onSelect={async () => {
        if (state === "available") {
          if (await promptInstall()) toast.success("Aoient is installing. Find it with your other apps.");
        } else onNeedHelp(state === "ios");
      }}
    >
      <Download />Install Aoient app
    </DropdownMenuItem>
  );
}
