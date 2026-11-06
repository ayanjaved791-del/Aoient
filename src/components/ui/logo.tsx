import { cn } from "@/lib/utils";

/**
 * Aoient monogram: the letters A, I and O drawn as fine lines inside a circle. Black on light backgrounds, inverted in dark mode.
 */
export function LogoMark({ className, strokeWidth = 5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("size-7 shrink-0", className)} aria-hidden>
      <circle cx="50" cy="50" r="50" className="fill-neutral-950 dark:fill-white" />
      <g fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="stroke-white dark:stroke-neutral-950">
        <path d="M28 82 L50 16 L72 82" />
        <path d="M50 10 V82" />
        <path d="M31 66 H69" />
        <circle cx="50" cy="66" r="6.5" />
      </g>
    </svg>
  );
}

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      <LogoMark />
      {withWordmark && <span className="text-[15px]">Aoient</span>}
    </span>
  );
}
