import { cn } from "@/lib/utils";

/** Aoient wordmark: an "orbit" glyph representing connected modules, on the brand gradient. */
export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      <svg viewBox="0 0 24 24" className="size-6 drop-shadow-[0_2px_6px_rgb(124_58_237/0.35)]" aria-hidden>
        <defs>
          <linearGradient id="aoient-logo-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#635bff" />
            <stop offset="0.55" stopColor="#c026d3" />
            <stop offset="1" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <rect width="24" height="24" rx="7" fill="url(#aoient-logo-gradient)" />
        <rect width="24" height="12" rx="7" fill="white" opacity="0.12" />
        <circle cx="12" cy="12" r="5.25" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="17.25" cy="8" r="1.75" fill="white" />
      </svg>
      {withWordmark && <span className="text-[15px]">Aoient</span>}
    </span>
  );
}
