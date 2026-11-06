"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** Switches between the light (white) and dark (black) theme. Icons swap with CSS, so no hydration mismatch. */
export function ThemeToggle({ className, label }: { className?: string; label?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Switch between light and dark theme"
      className={cn(
        "group inline-flex h-9 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-black dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white",
        className,
      )}
    >
      <span className="relative size-4">
        <Sun className="absolute inset-0 size-4 transition-all duration-500 group-hover:rotate-90 dark:-rotate-90 dark:scale-0 dark:opacity-0" aria-hidden />
        <Moon className="absolute inset-0 size-4 rotate-90 scale-0 opacity-0 transition-all duration-500 dark:rotate-0 dark:scale-100 dark:opacity-100" aria-hidden />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}
