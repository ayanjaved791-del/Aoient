"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, FileText, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchWorkspaceAction } from "./actions";

export interface PaletteLink { label: string; href: string; group: string }
type Hit = { id: string; group: string; title: string; subtitle: string | null; href: string };

/**
 * Ctrl/⌘ + K: jump to any page, or find a person, project, task, deal, lead,
 * company, contact, invoice or vendor. Results come from the server and only
 * include what the person's role can open.
 */
export function CommandPalette({ slug, links }: { slug: string; links: PaletteLink[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "/" && !open) {
        const t = e.target as HTMLElement | null;
        if (!t?.closest("input, textarea, select, [contenteditable=true]")) { e.preventDefault(); setOpen(true); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 10);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = prev; };
  }, [open]);

  // Server search, debounced; late answers for an older query are ignored.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { const id = setTimeout(() => setHits([]), 0); return () => clearTimeout(id); }
    const id = ++seq.current;
    const t = setTimeout(() => start(async () => {
      const res = await searchWorkspaceAction(slug, term);
      if (id === seq.current) { setHits(res.ok ? res.data : []); setActive(0); }
    }), 180);
    return () => clearTimeout(t);
  }, [q, slug]);

  const pages = useMemo(() => {
    const term = q.trim().toLowerCase();
    const found = term ? links.filter((l) => `${l.label} ${l.group}`.toLowerCase().includes(term)) : links;
    return found.slice(0, term ? 6 : 10).map((l) => ({ id: `page:${l.href}`, group: term ? "Pages" : "Go to", title: l.label, subtitle: l.group, href: l.href }));
  }, [q, links]);
  const items = useMemo(() => [...pages, ...hits], [pages, hits]);
  const groups = useMemo(() => {
    const out: { name: string; rows: (Hit & { index: number })[] }[] = [];
    items.forEach((it, index) => {
      const g = out.find((x) => x.name === it.group) ?? (out.push({ name: it.group, rows: [] }), out[out.length - 1]);
      g.rows.push({ ...it, index });
    });
    return out;
  }, [items]);

  function close() { setOpen(false); setQ(""); setHits([]); setActive(0); }
  function go(href: string) { close(); router.push(href); }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active].href); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  }
  useEffect(() => { list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search (Ctrl+K)"
        className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:w-56 lg:w-72">
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden truncate sm:inline">Search…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-surface-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[10vh] sm:p-6 sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search the workspace">
          <button type="button" tabIndex={-1} aria-hidden className="motion-safe:animate-overlay-in absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />
          <div className="motion-safe:animate-pop-in relative flex max-h-[70dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} maxLength={80}
                placeholder="Search people, projects, tasks, deals, invoices… or a page"
                aria-label="Search" aria-controls="palette-results" aria-activedescendant={items[active] ? `pal-${active}` : undefined}
                className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
              {pending && <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-foreground" aria-label="Searching" />}
              <kbd className="hidden rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground sm:inline">Esc</kbd>
            </div>
            <div ref={list} id="palette-results" role="listbox" className="scroll-thin overflow-y-auto p-2">
              {groups.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">{q.trim().length < 2 ? "Type at least 2 letters." : pending ? "Searching…" : `Nothing matches “${q.trim()}”.`}</p>
              ) : groups.map((g) => (
                <div key={g.name} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</p>
                  {g.rows.map((r) => (
                    <button key={r.id} id={`pal-${r.index}`} data-index={r.index} role="option" aria-selected={r.index === active} type="button"
                      onMouseMove={() => setActive(r.index)} onClick={() => go(r.href)}
                      className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm", r.index === active ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted")}>
                      {r.id.startsWith("page:") ? <ArrowRight className="size-4 shrink-0 opacity-60" aria-hidden /> : <FileText className="size-4 shrink-0 opacity-60" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                      {r.subtitle && <span className={cn("max-w-[45%] shrink-0 truncate text-xs", r.index === active ? "opacity-75" : "text-muted-foreground")}>{r.subtitle}</span>}
                      {r.index === active && <CornerDownLeft className="size-3.5 shrink-0 opacity-75" aria-hidden />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:flex">
              <span><kbd className="font-mono">↑ ↓</kbd> move</span><span><kbd className="font-mono">Enter</kbd> open</span><span><kbd className="font-mono">Esc</kbd> close</span>
              <span className="ml-auto">Only what your role can open</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
