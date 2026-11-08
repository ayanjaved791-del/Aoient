"use client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Building2, CreditCard, LogOut, Moon, Sun, UserCog } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { HowToDialog, InstallMenuItem } from "@/components/pwa/install-app";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ name, email, avatarUrl }: { name: string; email: string; avatarUrl?: string | null }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [installHelp, setInstallHelp] = useState<null | { ios: boolean }>(null);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <>
    <HowToDialog open={installHelp !== null} onOpenChange={(o) => !o && setInstallHelp(null)} ios={installHelp?.ios ?? false} />
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label="Account menu">
        <Avatar name={name} src={avatarUrl} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 pb-1.5 font-normal normal-case tracking-normal">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account"><UserCog />Account settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/organizations?all=1"><Building2 />All organizations</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/pricing"><CreditCard />Plans &amp; pricing</Link>
        </DropdownMenuItem>
        <InstallMenuItem onNeedHelp={(ios) => setInstallHelp({ ios })} />
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {([["light", Sun, "Light"], ["dark", Moon, "Dark"]] as const).map(([value, Icon, label]) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)} aria-checked={theme === value} role="menuitemradio">
            <Icon />{label}{theme === value && <span className="ml-auto text-xs text-primary">Active</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}
