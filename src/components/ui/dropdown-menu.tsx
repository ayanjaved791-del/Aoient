"use client";
import * as React from "react";
import { DropdownMenu as DM } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        className={cn("scroll-thin z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-48 origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-y-auto rounded-xl border border-border bg-surface/95 p-1.5 text-foreground shadow-lg ring-1 ring-black/5 backdrop-blur-md data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out", className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({ className, destructive, ...props }: React.ComponentProps<typeof DM.Item> & { destructive?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-muted data-[highlighted]:text-foreground data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground data-[highlighted]:[&_svg]:text-foreground",
        destructive && "text-danger [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn("px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} {...props} />;
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentProps<typeof DM.CheckboxItem>) {
  return (
    <DM.CheckboxItem
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2.5 rounded-md py-2 pl-8 pr-2.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-muted data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center rounded border border-input bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary" data-state={props.checked ? "checked" : "unchecked"}>
        <DM.ItemIndicator>
          <svg viewBox="0 0 16 16" className="size-3 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.CheckboxItem>
  );
}
