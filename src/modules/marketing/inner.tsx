import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Face, type FaceStyle } from "./home/doodles";

/**
 * Building blocks for the inner marketing pages (Features, Modules, Security,
 * Pricing, FAQ). Deliberately unlike the home page: left-aligned, editorial,
 * document-like, with a sticky index instead of big centred sections.
 */

/** Left-aligned page title with a breadcrumb, intro and a doodle on the side. */
export function InnerHero({ crumb, title, body, faces = [], children }: { crumb: string; title: string; body: string; faces?: FaceStyle[]; children?: ReactNode }) {
  return (
    <section className="border-b border-neutral-200 dark:border-neutral-900">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.6fr_1fr] lg:items-end">
        <div>
          <nav aria-label="Breadcrumb" className="animate-fade-up text-sm text-neutral-500">
            <Link href="/" className="hover:text-black dark:hover:text-white">Aoient</Link>
            <span className="mx-2">/</span>
            <span className="text-black dark:text-white">{crumb}</span>
          </nav>
          <h1 className="animate-fade-up mt-5 max-w-3xl text-balance text-4xl font-bold tracking-tighter sm:text-6xl" style={{ animationDelay: "60ms" }}>{title}</h1>
          <p className="animate-fade-up mt-5 max-w-2xl text-pretty text-lg text-neutral-600 dark:text-neutral-400" style={{ animationDelay: "120ms" }}>{body}</p>
          {children && <div className="animate-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>{children}</div>}
        </div>
        {faces.length > 0 && (
          <div aria-hidden className="animate-fade-up hidden justify-end gap-2 lg:flex" style={{ animationDelay: "200ms" }}>
            {faces.map((f, i) => <Face key={f} variant={f} className={cn("size-28", i % 2 ? "translate-y-5" : "")} />)}
          </div>
        )}
      </div>
    </section>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex h-11 items-center gap-2 rounded-lg bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-11 items-center rounded-lg border border-neutral-300 px-5 text-sm font-semibold transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
      {children}
    </Link>
  );
}

/** Sticky "On this page" index for long pages (desktop only). */
export function PageIndex({ items, title = "On this page" }: { items: { id: string; label: string }[]; title?: string }) {
  return (
    <nav aria-label={title} className="hidden lg:block">
      <div className="sticky top-24">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{title}</p>
        <ol className="mt-4 grid gap-1 border-l border-neutral-200 dark:border-neutral-800">
          {items.map((it, i) => (
            <li key={it.id}>
              <a href={`#${it.id}`} className="-ml-px flex gap-3 border-l border-transparent py-1.5 pl-4 text-sm text-neutral-600 transition-colors hover:border-black hover:text-black dark:text-neutral-400 dark:hover:border-white dark:hover:text-white">
                <span className="w-5 font-mono text-xs text-neutral-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {it.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

/** Closing strip used on inner pages: one line and two actions, no big banner. */
export function SlimCta({ title = "Try it with your own team.", body = "14-day free trial. No card needed to start." }: { title?: string; body?: string }) {
  return (
    <section className="border-t border-neutral-200 dark:border-neutral-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">{body}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PrimaryLink href="/sign-up">Get Aoient free</PrimaryLink>
          <SecondaryLink href="/pricing">See pricing</SecondaryLink>
        </div>
      </div>
    </section>
  );
}

/** Small monochrome status label. */
export function Status({ live, dark }: { live: boolean; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        live
          ? dark ? "bg-white text-black dark:bg-black dark:text-white" : "bg-black text-white dark:bg-white dark:text-black"
          : dark ? "border border-dashed border-white/30 text-white/60 dark:border-black/30 dark:text-black/60" : "border border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700",
      )}
    >
      {live ? "Live" : "In development"}
    </span>
  );
}
