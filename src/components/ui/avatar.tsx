import { cn } from "@/lib/utils";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/**
 * Profile picture when there is one (served by Aoient to signed-in members
 * only), initials otherwise. Decorative: the name is always shown next to it.
 */
export function Avatar({ name, src, className, size = "md" }: { name: string; src?: string | null; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary-subtle font-semibold text-primary",
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-10 text-sm",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- private image behind a membership check, not optimisable
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Organization logo, or its first letter on a dark square. */
export function OrgMark({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-md font-semibold",
        src ? "bg-white ring-1 ring-border dark:bg-white" : "bg-navy text-white dark:bg-primary",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- private image behind a membership check, not optimisable
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-contain" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
