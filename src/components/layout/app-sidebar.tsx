"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3, Building2, CalendarDays, Contact, Network, Timer, ClipboardCheck, ChartColumn, CreditCard, FolderKanban, Handshake, Gauge, LayoutDashboard, ListTodo, Landmark, FileText, FileSignature, Receipt, Store, Palette, Magnet, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, SlidersHorizontal, Users, UsersRound, X,
  CalendarCheck, Boxes, Package, ArrowLeftRight, Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { overview: LayoutDashboard, members: Users, roles: ShieldCheck, general: Building2, billing: CreditCard, people: Contact, departments: Network, leave: CalendarDays, pipeline: Handshake, leads: Magnet, contacts: UsersRound, companies: Building2, reports: BarChart3, crmsettings: SlidersHorizontal, projects: FolderKanban, mytasks: ListTodo, workload: Gauge, finance: Landmark, invoices: FileText, estimates: FileSignature, expenses: Receipt, vendors: Store, editor: Palette, time: Timer, approvals: ClipboardCheck, timereports: ChartColumn, attendance: CalendarCheck, inventory: Boxes, products: Package, movements: ArrowLeftRight, locations: Warehouse } as const;

export interface SidebarLink { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean }
export interface SidebarGroup { label?: string; links: SidebarLink[] }


function isActive(pathname: string, link: SidebarLink) {
  return link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function SidebarBody({ groups, top, bottom }: { groups: SidebarGroup[]; top: ReactNode; bottom: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">{top}</div>
      <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 py-4">
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
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-secondary-foreground hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} aria-hidden />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

      </nav>
      {bottom && <div className="shrink-0 border-t border-border p-3">{bottom}</div>}
    </div>
  );
}

/** Desktop: a fixed column beside the page. */
export function AppSidebar(props: { groups: SidebarGroup[]; top: ReactNode; bottom: ReactNode }) {
  // Always ink-black, in light and dark mode alike: Aoient's black-and-white look.
  return (
    <aside id="workspace-sidebar" className="dark sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-sidebar text-foreground lg:block lg:nav-closed:hidden print:hidden">
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
          <div className="dark motion-safe:animate-drawer-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-sidebar text-foreground shadow-lg">
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

const NAV_EVENT = "aoient-nav";
const navClosed = () => document.documentElement.dataset.nav === "closed";
function subscribeNav(cb: () => void) {
  window.addEventListener(NAV_EVENT, cb);
  return () => window.removeEventListener(NAV_EVENT, cb);
}

function toggleNav() {
  const next = !navClosed();
  if (next) document.documentElement.dataset.nav = "closed";
  else delete document.documentElement.dataset.nav;
  try { localStorage.setItem("aoient-nav", next ? "closed" : "open"); } catch { /* private mode: still works for this visit */ }
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** Desktop: closes the sidebar for more room, and opens it again. Remembered on this device. */
export function SidebarToggle() {
  const closed = useSyncExternalStore(subscribeNav, navClosed, () => false);
  useEffect(() => {
    // Ctrl/⌘ + B, as in most editors, unless typing in a field.
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      toggleNav();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const label = closed ? "Open sidebar" : "Close sidebar";
  return (
    <button type="button" onClick={toggleNav} aria-label={label} title={`${label} (Ctrl+B)`} aria-controls="workspace-sidebar" aria-expanded={!closed}
      className="hidden size-9 shrink-0 items-center justify-center rounded-md text-secondary-foreground hover:bg-surface-muted hover:text-foreground lg:flex">
      <PanelLeftClose className="size-4 nav-closed:hidden" aria-hidden />
      <PanelLeftOpen className="hidden size-4 nav-closed:block" aria-hidden />
    </button>
  );
}
