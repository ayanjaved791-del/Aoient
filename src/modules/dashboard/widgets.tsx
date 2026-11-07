"use client";
import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Download, LayoutGrid, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface WidgetDef { id: string; label: string }

const Ctx = createContext<{ hidden: Set<string> }>({ hidden: new Set() });

/**
 * Which dashboard cards a viewer has hidden. A per-browser convenience, kept in
 * localStorage; it never affects what the server lets anyone see.
 */
export function DashboardLayout({ storageKey, widgets, exportHref, filter, children }: { storageKey: string; widgets: WidgetDef[]; exportHref: string | null; filter?: ReactNode; children: ReactNode }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
    } catch { /* storage unavailable: show everything */ }
    setUpdatedAt(new Date());
  }, [storageKey]);

  function toggle(id: string, show: boolean) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (show) next.delete(id); else next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }
  function reset() {
    setHidden(new Set());
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }

  return (
    <Ctx.Provider value={{ hidden }}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">{filter}</div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {refreshing ? "Refreshing…" : updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : " "}
        </p>
        <Button variant="secondary" size="sm" disabled={refreshing}
          onClick={() => startRefresh(() => { router.refresh(); setUpdatedAt(new Date()); })}>
          <RefreshCw className={cn(refreshing && "animate-spin")} />Refresh
        </Button>
        {exportHref && (
          <Button variant="secondary" size="sm" asChild>
            <a href={exportHref} download><Download />Export CSV</a>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm"><LayoutGrid />Customize{hidden.size > 0 && <span className="rounded-full bg-primary-subtle px-1.5 text-[11px] text-primary">{widgets.length - hidden.size}/{widgets.length}</span>}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Show on dashboard</DropdownMenuLabel>
            {widgets.map((w) => (
              <DropdownMenuCheckboxItem key={w.id} checked={!hidden.has(w.id)} onCheckedChange={(c) => toggle(w.id, c === true)} onSelect={(e) => e.preventDefault()}>
                {w.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={reset} disabled={hidden.size === 0}><RotateCcw />Show everything</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={cn("grid gap-6 transition-opacity", refreshing && "opacity-60")}>{children}</div>
    </Ctx.Provider>
  );
}

export function Widget({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const { hidden } = useContext(Ctx);
  if (hidden.has(id)) return null;
  return <div className={cn("min-w-0", className)}>{children}</div>;
}
