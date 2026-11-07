"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3, Briefcase, Building2, CircleDashed, Clock3, CreditCard, FolderKanban, LayoutDashboard, Menu, ShieldCheck, Users, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { overview: LayoutDashboard, members: Users, roles: ShieldCheck, general: Building2, billing: CreditCard } as const;

export interface SidebarLink { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean }
export interface SidebarGroup { label?: string; links: SidebarLink[] }

/** Modules that are planned but not built. Shown as plain text, never as links. */
const SOON = [
  { label: "People", icon: Briefcase },
  { label: "CRM", icon: BarChart3 },
  { label: "Projects", icon: FolderKanban },
  { label: "Time", icon: Clock3 },
  { label: "Finance", icon: Wallet },
];

function isActive(pathname: string, link: SidebarLink) {
  return link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function SidebarBody({ groups, top, bottom }: { groups: SidebarGroup[]; top: ReactNode; bottom: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">{top}</div>
      <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g, i) => (
          <div key={g.label ?? i} className={cn(i > 0 && "mt-6")}>
            {g.label && <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>}
            <ul className="grid gap-0.5">
              {g.links.map((link) => {
                const active = isActive(pathname, link);
                const Icon = ICONS[link.icon];
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary-subtle text-primary"
                          : "text-secondary-foreground hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      {active && <span aria-hidden className="absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary" />}
                      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} aria-hidden />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-6">
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Coming next</p>
          <ul className="grid gap-0.5" aria-label="Modules not available yet">
            {SOON.map(({ label, icon: Icon }) => (
              <li key={label} className="flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground/80">
                <Icon className="size-4 shrink-0 opacity-60" aria-hidden />
                {label}
                <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-dashed border-border px-1.5 py-px text-[10px] font-medium">
                  <CircleDashed className="size-2.5" aria-hidden />Soon
                </span>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      {bottom && <div className="shrink-0 border-t border-border p-3">{bottom}</div>}
    </div>
  );
}

/** Desktop: a fixed column beside the page. */
export function AppSidebar(props: { groups: SidebarGroup[]; top: ReactNode; bottom: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-sidebar lg:block">
      <SidebarBody {...props} />
    </aside>
  );
}

/** Phone/tablet: a drawer that closes on navigation, Escape or a tap outside. */
export function MobileNav(props: { groups: SidebarGroup[]; top: ReactNode; bottom: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-secondary-foreground hover:bg-surface-muted lg:hidden"
      >
        <Menu className="size-4" aria-hidden />
      </button>
      {/* Portalled: the blurred header would otherwise become the drawer's containing block. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" tabIndex={-1} aria-hidden className="motion-safe:animate-overlay-in absolute inset-0 bg-navy/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="motion-safe:animate-drawer-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-sidebar shadow-lg">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              autoFocus
              className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
            <SidebarBody {...props} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
