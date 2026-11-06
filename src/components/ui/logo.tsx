import { cn } from "@/lib/utils";

/** Aoient wordmark: an "orbit" glyph representing connected modules. */
export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect width="24" height="24" rx="6" className="fill-navy dark:fill-primary" />
        <circle cx="12" cy="12" r="5.25" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="17.25" cy="8" r="1.75" className="fill-[#a5a0ff] dark:fill-white" />
      </svg>
      {withWordmark && <span className="text-[15px]">Aoient</span>}
    </span>
  );
}
