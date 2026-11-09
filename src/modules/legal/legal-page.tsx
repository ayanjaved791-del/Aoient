import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/legal";

export interface LegalSection { id: string; title: string; body: ReactNode }

/** Shared layout for the Terms and Privacy pages: header, table of contents, numbered sections. */
export function LegalPage({ title, intro, sections, other }: { title: string; intro: ReactNode; sections: LegalSection[]; other: { href: string; label: string } }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-neutral-500">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-6 text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">{intro}</div>
      </header>
      <div className="mt-14 grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">On this page</p>
          <ol className="mt-3 grid gap-1.5 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}><a href={`#${s.id}`} className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white">{i + 1}. {s.title}</a></li>
            ))}
          </ol>
          <Link href={other.href} className="mt-6 inline-block text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline">{other.label} →</Link>
        </nav>
        <article className="grid max-w-3xl gap-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-semibold">{i + 1}. {s.title}</h2>
              <div className="mt-3 grid gap-3 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300 [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1.5">{s.body}</div>
            </section>
          ))}
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            Questions about this document?{" "}
            {LEGAL_CONTACT_EMAIL ? <>Email <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-medium text-black underline underline-offset-4 dark:text-white">{LEGAL_CONTACT_EMAIL}</a>.</> : <>Ask the owner of your workspace, who can reach us through the account they used to subscribe.</>}
          </p>
        </article>
      </div>
    </div>
  );
}
