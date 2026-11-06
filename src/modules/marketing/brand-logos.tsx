import { siNextdotjs, siPaddle, siPostgresql, siSupabase, siTypescript, siVercel, type SimpleIcon } from "simple-icons";
import { cn } from "@/lib/utils";

/**
 * Real brand marks (Simple Icons) for the services Aoient is actually built on.
 * Only technology the product really uses is listed here — no implied integrations.
 */
const STACK: { icon: SimpleIcon; role: string; tile: string; glyph: string }[] = [
  { icon: siSupabase, role: "Auth & database", tile: "bg-[#1c1c1c]", glyph: "fill-[#3FCF8E]" },
  { icon: siPaddle, role: "Payments & tax", tile: "bg-[#FDDD35]", glyph: "fill-black" },
  { icon: siPostgresql, role: "Data storage", tile: "bg-[#336791]", glyph: "fill-white" },
  { icon: siNextdotjs, role: "Web app", tile: "bg-black ring-white/15 dark:bg-white", glyph: "fill-white dark:fill-black" },
  { icon: siVercel, role: "Hosting", tile: "bg-black ring-white/15 dark:bg-white", glyph: "fill-white dark:fill-black" },
  { icon: siTypescript, role: "Type-safe code", tile: "bg-[#3178C6]", glyph: "fill-white" },
];

export function BrandMark({ icon, className }: { icon: SimpleIcon; className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className}>
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
}

export function TechStack() {
  return (
    <section aria-labelledby="stack-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p id="stack-heading" className="reveal text-center text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        Built on infrastructure you already trust
      </p>
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STACK.map(({ icon, role, tile, glyph }, i) => (
          <li key={icon.slug} className="reveal" style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}>
            <div
              data-spotlight
              className="group flex h-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl shadow-md ring-1 ring-inset ring-black/5 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", tile)}>
                <BrandMark icon={icon} className={cn("size-5", glyph)} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-black dark:text-white">{icon.title}</span>
                <span className="block truncate text-xs text-neutral-500">{role}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
