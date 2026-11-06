import {
  siAirtable, siAsana, siCalendly, siDropbox, siFigma, siGithub, siGmail, siGooglecalendar, siGoogledrive, siGooglemeet,
  siGooglesheets, siHubspot, siJira, siMailchimp, siNextdotjs, siNotion, siPaddle, siPaypal, siPostgresql, siQuickbooks,
  siStripe, siSupabase, siTrello, siTypescript, siVercel, siWhatsapp, siXero, siZapier, siZoom,
  type SimpleIcon,
} from "simple-icons";
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
      <p id="stack-heading" data-reveal="blur" className="reveal text-center text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        Built on infrastructure you already trust
      </p>
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STACK.map(({ icon, role, tile, glyph }, i) => (
          <li key={icon.slug} data-reveal="scale" className="reveal" style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}>
            <div
              data-spotlight
              data-tilt="10"
              className="group flex h-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl shadow-md ring-1 ring-inset ring-black/5 motion-safe:animate-bob group-hover:scale-110", tile)} style={{ animationDelay: `${i * 0.35}s` }}>
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

/**
 * Tools Aoient Connect is planned to integrate with. None are connected yet;
 * every place these appear says so.
 */
export const PLANNED_INTEGRATIONS: SimpleIcon[] = [
  siGmail, siGooglecalendar, siGoogledrive, siGooglesheets, siGooglemeet, siZoom, siStripe, siPaypal,
  siQuickbooks, siXero, siHubspot, siNotion, siGithub, siFigma, siTrello, siAsana, siJira, siDropbox,
  siZapier, siCalendly, siWhatsapp, siMailchimp, siAirtable,
];

/** Very dark brand colours are drawn in the page's foreground colour so they stay visible in dark mode. */
function isNearBlack(hex: string) {
  const n = parseInt(hex, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 40;
}

/** A real brand logo, in the brand's own colour, on a neutral tile. */
export function BrandTile({ icon, className, glyphClassName }: { icon: SimpleIcon; className?: string; glyphClassName?: string }) {
  const dark = isNearBlack(icon.hex);
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900",
        className,
      )}
    >
      <svg role="img" viewBox="0 0 24 24" className={cn("size-5", dark && "fill-black dark:fill-white", glyphClassName)} style={dark ? undefined : { fill: `#${icon.hex}` }}>
        <title>{icon.title}</title>
        <path d={icon.path} />
      </svg>
    </span>
  );
}
