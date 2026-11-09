"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Tabs across a section (People, CRM). Only tabs the role can open are passed in. */
export function PeopleNav({ items, label = "People" }: { items: { href: string; label: string; badge?: number | null; exact?: boolean }[]; label?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="scroll-thin -mb-px flex gap-1 overflow-x-auto border-b border-border">
      {items.map((i) => {
        const active = i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {i.label}
            {i.badge ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{i.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
