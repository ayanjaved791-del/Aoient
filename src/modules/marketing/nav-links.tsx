"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./nav-items";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Desktop page links; the current page is highlighted and marked for screen readers. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-full px-3 py-1.5 text-sm transition-colors after:absolute after:inset-x-3 after:bottom-0.5 after:h-px after:origin-left after:bg-gradient-to-r after:from-violet-500 after:to-orange-400 after:transition-transform after:duration-300 hover:after:scale-x-100",
              active
                ? "bg-neutral-100 font-medium text-black after:scale-x-100 dark:bg-neutral-900 dark:text-white"
                : "text-neutral-600 after:scale-x-0 hover:bg-neutral-100 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone menu; closes itself after navigating to another page. */
export function MobileMenu({ extra }: { extra: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details ref={ref} className="group relative md:hidden">
      <summary
        aria-label="Open menu"
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 [&::-webkit-details-marker]:hidden"
      >
        <Menu className="size-4" aria-hidden />
      </summary>
      <nav
        aria-label="Main"
        className="animate-fade-up absolute right-0 top-11 grid w-52 gap-0.5 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
      >
        {[...NAV, ...extra].map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900",
                active && "bg-neutral-100 font-medium dark:bg-neutral-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </details>
  );
}
