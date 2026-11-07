"use client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Building2, CreditCard, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label="Account menu">
        <Avatar name={name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 pb-1.5 font-normal normal-case tracking-normal">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/organizations"><Building2 />All organizations</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/pricing"><CreditCard />Plans &amp; pricing</Link>
        </DropdownMenuItem>
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
  );
}
