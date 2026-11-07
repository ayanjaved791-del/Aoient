"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowUp, Bot, Lock, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssistantAnswer } from "@/server/assistant/answer";
import { askAssistantAction } from "./actions";

type Entry = { id: number; role: "user"; text: string } | { id: number; role: "assistant"; answer: AssistantAnswer } | { id: number; role: "error"; text: string };

function Answer({ a, onAsk, onNavigate }: { a: AssistantAnswer; onAsk: (q: string) => void; onNavigate: () => void }) {
  return (
    <div className="grid gap-3">
      <p className="whitespace-pre-line text-sm leading-relaxed">
        {a.restricted && <Lock className="mr-1.5 inline size-3.5 -translate-y-px text-warning" aria-label="Limited by your role" />}
        {a.text}
      </p>
      {a.stats && a.stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-2">
          {a.stats.map((s) => (
            <div key={s.label} className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2">
              <dt className="truncate text-[11px] text-muted-foreground">{s.label}</dt>
              <dd className="truncate text-sm font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {a.items && a.items.length > 0 && (
        <ul className="scroll-thin grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-border bg-surface p-1">
          {a.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-surface-muted">
              <span className="grid min-w-0 flex-1">
                <span className="[overflow-wrap:anywhere]">{it.title}</span>
                {it.subtitle && <span className="truncate text-xs text-muted-foreground">{it.subtitle}</span>}
              </span>
              {it.meta && <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{it.meta}</span>}
            </li>
          ))}
        </ul>
      )}
      {a.links && a.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {a.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} onClick={onNavigate} className="inline-flex h-8 items-center rounded-full border border-primary/30 bg-primary-subtle px-3 text-xs font-medium text-primary hover:bg-primary/15">
              {l.label} →
            </Link>
          ))}
        </div>
      )}
      {a.suggestions && a.suggestions.length > 0 && <Chips items={a.suggestions} onAsk={onAsk} />}
    </div>
  );
}

function Chips({ items, onAsk }: { items: string[]; onAsk: (q: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <button key={s} type="button" onClick={() => onAsk(s)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs text-secondary-foreground transition-colors hover:border-primary/40 hover:text-foreground">
          {s}
        </button>
      ))}
    </div>
  );
}

/**
 * Workspace assistant: a chat panel that answers from this workspace's records
 * with rules written in code (no AI service). The server decides what the
 * person's role may see on every question.
 */
export function AssistantPanel({ slug, organizationName, roleName, suggestions, fullAccess }: { slug: string; organizationName: string; roleName: string; suggestions: string[]; fullAccess: boolean }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  // Ctrl/⌘ + J toggles the assistant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [entries, pending]);

  function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setInput("");
    setEntries((e) => [...e, { id: nextId.current++, role: "user", text: q }]);
    startTransition(async () => {
      const res = await askAssistantAction(slug, q);
      setEntries((e) => [...e, res.ok ? { id: nextId.current++, role: "assistant", answer: res.data } : { id: nextId.current++, role: "error", text: res.error.message }]);
    });
  }
  const submit = (e: FormEvent) => { e.preventDefault(); ask(input); };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant (Ctrl+J)"}
        aria-expanded={open}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 pl-4 pr-5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/20 transition-all hover:-translate-y-0.5 hover:shadow-xl",
          open && "pointer-events-none scale-90 opacity-0",
        )}
      >
        <Sparkles className="size-4" aria-hidden />Ask Aoient
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Aoient assistant"
          className="motion-safe:animate-pop-in fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-40px))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-border sm:shadow-lg"
        >
          <header className="relative flex items-center gap-3 overflow-hidden border-b border-border bg-navy px-4 py-3 text-white dark:bg-[#141a2e]">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-violet-500/40 blur-3xl" />
            <span className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500"><Bot className="size-5" aria-hidden /></span>
            <div className="relative min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Aoient Assistant</h2>
              <p className="truncate text-xs text-white/60">{organizationName} · {fullAccess ? `${roleName} access` : `${roleName}: your own info`}</p>
            </div>
            {entries.length > 0 && (
              <button type="button" onClick={() => setEntries([])} aria-label="Clear conversation" className="relative flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">
                <RotateCcw className="size-4" aria-hidden />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="relative flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">
              <X className="size-4" aria-hidden />
            </button>
          </header>

          <div ref={listRef} className="scroll-thin flex-1 overflow-y-auto bg-background px-4 py-4" aria-live="polite">
            {entries.length === 0 && (
              <div className="grid gap-4">
                <div className="rounded-2xl rounded-tl-sm border border-border bg-surface p-4">
                  <p className="text-sm leading-relaxed">
                    Hi! Ask me about {fullAccess ? `${organizationName}: your team, roles, invitations, plan and activity` : "your role, your permissions and what you've done"}. I answer straight from your workspace&apos;s records, in English or Roman Urdu.
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Try asking</p>
                  <Chips items={suggestions} onAsk={ask} />
                </div>
              </div>
            )}
            <ol className="grid gap-4">
              {entries.map((e) => (
                <li key={e.id} className={cn("flex", e.role === "user" ? "justify-end" : "justify-start")}>
                  {e.role === "user" ? (
                    <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground [overflow-wrap:anywhere]">{e.text}</p>
                  ) : e.role === "error" ? (
                    <p className="max-w-[90%] rounded-2xl rounded-tl-sm border border-danger/30 bg-danger-subtle px-3.5 py-2 text-sm text-danger">{e.text}</p>
                  ) : (
                    <div className="w-full max-w-[95%] rounded-2xl rounded-tl-sm border border-border bg-surface-muted/60 p-3.5">
                      <Answer a={e.answer} onAsk={ask} onNavigate={() => setOpen(false)} />
                    </div>
                  )}
                </li>
              ))}
              {pending && (
                <li className="flex" aria-label="Looking that up">
                  <span className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3">
                    {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 120}ms` }} />)}
                  </span>
                </li>
              )}
            </ol>
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-border bg-surface p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={300}
              placeholder="Ask about your workspace…"
              aria-label="Your question"
              className="h-10 min-w-0 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
            />
            <button type="submit" disabled={!input.trim() || pending} aria-label="Ask" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40">
              <ArrowUp className="size-4" aria-hidden />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
