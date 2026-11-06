"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsNav({ base }: { base: string }) {
  const pathname = usePathname();
  const items = [
    { href: `${base}/general`, label: "General", icon: Building2 },
    { href: `${base}/members`, label: "Members", icon: Users },
    { href: `${base}/roles`, label: "Roles & permissions", icon: ShieldCheck },
    { href: `${base}/billing`, label: "Billing & plan", icon: CreditCard },
  ];
  return (
    <nav aria-label="Settings" className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary-subtle text-primary" : "text-secondary-foreground hover:bg-surface-muted hover:text-foreground")}>
            <Icon className="size-4" aria-hidden />{label}
          </Link>
        );
      })}
    </nav>
  );
}
