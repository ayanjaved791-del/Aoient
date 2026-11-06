"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Light by default, regardless of the operating system's dark mode (product
 * owner decision). Users can still choose Dark manually. A new storage key
 * ignores any "system" preference saved by earlier versions.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="aoient-theme" disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
