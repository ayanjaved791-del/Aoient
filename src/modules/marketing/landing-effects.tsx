"use client";
import { useEffect } from "react";

/**
 * Progressive enhancement for the landing page:
 * - fades `.reveal` elements in as they scroll into view;
 * - feeds the pointer position to `[data-spotlight]` cards.
 * Without JavaScript every section is simply visible.
 */
export function LandingEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const items = Array.from(document.querySelectorAll<HTMLElement>(".landing .reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    root.classList.add("reveal-ready");
    items.forEach((el) => observer.observe(el));

    function onPointerMove(event: PointerEvent) {
      const card = (event.target as Element | null)?.closest<HTMLElement>("[data-spotlight]");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--y", `${event.clientY - rect.top}px`);
    }
    document.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      observer.disconnect();
      root.classList.remove("reveal-ready");
      document.removeEventListener("pointermove", onPointerMove);
    };
  }, []);
  return null;
}
