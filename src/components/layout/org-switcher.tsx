"use client";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SwitcherOrg { slug: string; name: string; roleName: string }

/**
 * Switching is just navigation to another slug; the server re-verifies
 * membership for the destination on every request.
 */
export function OrgSwitcher({ current, organizations }: { current: SwitcherOrg; organizations: SwitcherOrg[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-muted" aria-label="Switch organization">
        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-navy text-[11px] font-semibold text-white dark:bg-primary">
          {current.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 truncate text-sm font-medium">{current.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {organizations.map((o) => (
          <DropdownMenuItem key={o.slug} asChild>
            <Link href={`/${o.slug}`} className="flex items-center gap-2">
              <span className="grid min-w-0 flex-1">
                <span className="truncate">{o.name}</span>
                <span className="truncate text-xs text-muted-foreground">{o.roleName}</span>
              </span>
              {o.slug === current.slug && <Check className="!text-primary" aria-label="Current" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/organizations/new"><Plus />Create organization</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
