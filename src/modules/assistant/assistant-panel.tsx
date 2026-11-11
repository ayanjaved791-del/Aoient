"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowUp, Bot, Check, CircleCheck, Lock, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssistantAnswer } from "@/server/assistant/answer";
import { askAssistantAction, resolveAssistantProposalAction } from "./actions";

type Entry = { id: number; role: "user"; text: string } | { id: number; role: "assistant"; answer: AssistantAnswer; proposalState?: ProposalState } | { id: number; role: "error"; text: string };

type ProposalState = "open" | "busy" | "confirmed" | "cancelled";

/** A change Ant wants to make. Nothing happens until Confirm is pressed (or "yes" is typed). */
function ProposalCard({ p, state, onResolve }: { p: NonNullable<AssistantAnswer["proposal"]>; state: ProposalState; onResolve: (confirm: boolean) => void }) {
  const danger = p.verb === "delete";
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-surface", danger ? "border-danger/40" : "border-primary/30")}>
      <div className={cn("flex items-center gap-2 px-3 py-2 text-xs font-semibold", danger ? "bg-danger-subtle text-danger" : "bg-primary-subtle text-primary")}>
        <ShieldCheck className="size-3.5" aria-hidden />Needs your OK
      </div>
      <div className="grid gap-2 p-3">
        <p className="text-sm font-semibold">{p.title}</p>
        <dl className="grid gap-1 text-xs">
          {p.fields.map((f) => (
            <div key={f.label} className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">{f.label}</dt><dd className="min-w-0 [overflow-wrap:anywhere]">{f.value}</dd></div>
          ))}
        </dl>
        {state === "confirmed" ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-success"><CircleCheck className="size-3.5" aria-hidden />Confirmed</p>
        ) : state === "cancelled" ? (
          <p className="text-xs text-muted-foreground">Cancelled. Nothing was changed.</p>
        ) : (
          <div className="mt-1 flex gap-2">
            <button type="button" disabled={state === "busy"} onClick={() => onResolve(true)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white disabled:opacity-50", danger ? "bg-danger" : "bg-primary text-primary-foreground")}>
              <Check className="size-3.5" aria-hidden />{danger ? "Yes, do it" : "Confirm"}
            </button>
            <button type="button" disabled={state === "busy"} onClick={() => onResolve(false)} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-muted disabled:opacity-50">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Answer({ a, onAsk, onNavigate, proposalState, onResolve }: { a: AssistantAnswer; onAsk: (q: string) => void; onNavigate: () => void; proposalState?: ProposalState; onResolve?: (confirm: boolean) => void }) {
  return (
    <div className="grid gap-3">
      <p className="whitespace-pre-line text-sm leading-relaxed">
        {a.restricted && <Lock className="mr-1.5 inline size-3.5 -translate-y-px text-warning" aria-label="Limited by your role" />}
        {a.done && <CircleCheck className="mr-1.5 inline size-3.5 -translate-y-px text-success" aria-hidden />}
        {a.text}
      </p>
      {a.proposal && onResolve && <ProposalCard p={a.proposal} state={proposalState ?? "open"} onResolve={onResolve} />}
      {a.sections && a.sections.length > 0 && (
        <div className="grid gap-2">
          {a.sections.map((sec) => (
            <div key={sec.module} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec.title}</p>
                <Link href={sec.href} onClick={onNavigate} className="text-xs font-medium text-primary hover:underline">Open →</Link>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {sec.stats.map((st) => (
                  <div key={st.label} className="min-w-0"><dt className="truncate text-[11px] text-muted-foreground">{st.label}</dt><dd className="truncate text-sm font-semibold tabular-nums">{st.value}</dd></div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
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
 * Ant, the workspace assistant: a chat panel that answers from this workspace's
 * records with rules written in code (no AI service). Changes it proposes only
 * run after the person confirms them. The server decides what the
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
      setEntries((e) => {
        let list = e;
        // A typed "yes"/"no" answered the latest open proposal: show it as handled.
        if (res.ok && res.data.intent === "command" && !res.data.proposal) {
          const open = [...e].reverse().find((x) => x.role === "assistant" && x.answer.proposal && (!x.proposalState || x.proposalState === "open"));
          if (open && /^\s*(yes|y|yeah|yep|sure|ok|okay|confirm|confirmed|do it|go ahead|proceed|haan|han|ha|ji|ji haan|jee|theek hai|thik hai|kar do|kardo|no|n|nope|cancel|stop|nahi|nahin|na|mat karo|rehne do|chhoro|chhodo)[.!]*\s*$/i.test(q)) {
            list = e.map((x) => (x.id === open.id && x.role === "assistant" ? { ...x, proposalState: (res.data.done ? "confirmed" : "cancelled") as ProposalState } : x));
          }
        }
        return [...list, res.ok ? { id: nextId.current++, role: "assistant", answer: res.data } : { id: nextId.current++, role: "error", text: res.error.message }];
      });
    });
  }
  const submit = (e: FormEvent) => { e.preventDefault(); ask(input); };

  function resolve(entryId: number, proposalId: string, confirm: boolean) {
    setEntries((list) => list.map((x) => (x.id === entryId && x.role === "assistant" ? { ...x, proposalState: "busy" } : x)));
    startTransition(async () => {
      const res = await resolveAssistantProposalAction(slug, proposalId, confirm);
      setEntries((list) => [
        ...list.map((x) => (x.id === entryId && x.role === "assistant" ? { ...x, proposalState: (res.ok ? (confirm ? "confirmed" : "cancelled") : "open") as ProposalState } : x)),
        res.ok ? { id: nextId.current++, role: "assistant" as const, answer: res.data } : { id: nextId.current++, role: "error" as const, text: res.error.message },
      ]);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant (Ctrl+J)"}
        aria-expanded={open}
        className={cn(
          "fixed bottom-5 right-5 z-40 print:hidden flex h-12 items-center gap-2 rounded-full bg-primary pl-4 pr-5 text-sm font-semibold text-primary-foreground ring-1 ring-border shadow-lg ring-1 ring-white/20 transition-all hover:-translate-y-0.5 hover:shadow-xl",
          open && "pointer-events-none scale-90 opacity-0",
        )}
      >
        <Sparkles className="size-4" aria-hidden />Ask Ant
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Ant, the Aoient assistant"
          className="motion-safe:animate-pop-in fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-40px))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-border sm:shadow-lg"
        >
          <header className="relative flex items-center gap-3 overflow-hidden border-b border-border bg-navy px-4 py-3 text-white dark:bg-[#161616]">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.09)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_left,black,transparent_80%)]" />
            <span className="relative flex size-9 items-center justify-center rounded-xl bg-white text-navy"><Bot className="size-5" aria-hidden /></span>
            <div className="relative min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Ant</h2>
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
                    Hi, I&apos;m Ant! Ask me for a summary of {fullAccess ? organizationName : "your work"}, or tell me to create or delete something. I answer from your workspace&apos;s records, in English or Roman Urdu, and I never change anything until you press Confirm.
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
                      <Answer a={e.answer} onAsk={ask} onNavigate={() => setOpen(false)} proposalState={e.proposalState}
                        onResolve={e.answer.proposal ? (c) => resolve(e.id, e.answer.proposal!.id, c) : undefined} />
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
              placeholder="Ask Ant, or tell it what to do…"
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
