"use client";
import { useMemo, useState } from "react";
import { FAQ, FAQ_TOPICS, type FaqTopic } from "./faq-data";
import { cn } from "@/lib/utils";

/** FAQ page body: search box, topic filter and questions grouped by topic. */
export function FaqBrowser() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<FaqTopic | "all">("all");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_TOPICS.filter((t) => topic === "all" || t.id === topic)
      .map((t) => ({ ...t, items: FAQ.filter((f) => f.topic === t.id && (!q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))) }))
      .filter((g) => g.items.length > 0);
  }, [query, topic]);
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[220px_1fr] lg:gap-16">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <label htmlFor="faq-search" className="sr-only">Search questions</label>
        <input
          id="faq-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions"
          className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-4 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-black dark:border-neutral-700 dark:bg-black dark:focus:border-white"
        />
        <div role="radiogroup" aria-label="Topic" className="mt-4 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {[{ id: "all" as const, label: "All topics" }, ...FAQ_TOPICS].map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={topic === t.id}
              onClick={() => setTopic(t.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                topic === t.id ? "bg-black text-white dark:bg-white dark:text-black" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </aside>

      <div>
        <p className="text-sm text-neutral-500" aria-live="polite">{count === 1 ? "1 question" : `${count} questions`}</p>
        {groups.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            Nothing matches &ldquo;{query}&rdquo;. Try another word.
          </p>
        )}
        {groups.map((g) => (
          <section key={g.id} id={g.id} className="mt-8 scroll-mt-24 first:mt-4">
            <h2 className="text-xl font-bold tracking-tight">{g.label}</h2>
            <div className="mt-3 border-t border-neutral-200 dark:border-neutral-800">
              {g.items.map((f) => (
                <details key={f.q} className="group border-b border-neutral-200 dark:border-neutral-800">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="relative size-4 shrink-0">
                      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-current" />
                      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-current transition-transform duration-300 group-open:rotate-90 group-open:opacity-0" />
                    </span>
                  </summary>
                  <p className="animate-fade-up max-w-3xl pb-6 leading-relaxed text-neutral-600 dark:text-neutral-400">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
