"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Progressive enhancement for the landing page. Without JavaScript every
 * section is simply visible; with reduced motion, pointer effects are skipped.
 * - reveals `.reveal`, `.words`, `.stagger` and `.draw` elements on scroll;
 * - spotlight, 3D tilt and magnetic pull that follow the pointer;
 * - scroll progress bar, header state and hero preview parallax.
 */
export function LandingEffects() {
  // The effects live in the shared marketing layout, so re-scan whenever the page changes.
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-shown", "");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    // Start once the page has hydrated and the browser is idle: React first
    // compares the server HTML, so touching these elements earlier is a mismatch.
    const startReveal = () => {
      root.classList.add("reveal-ready");
      document.querySelectorAll(".landing :is(.reveal, .words, .stagger, .draw, .logo-rain)").forEach((el) => observer.observe(el));
    };
    const idleId = "requestIdleCallback" in window ? window.requestIdleCallback(startReveal, { timeout: 600 }) : null;
    const timeoutId = idleId === null ? window.setTimeout(startReveal, 200) : null;

    let frame = 0;
    const hero = document.querySelector<HTMLElement>("[data-hero]");
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = root.scrollHeight - window.innerHeight;
        root.style.setProperty("--progress", String(max > 0 ? window.scrollY / max : 0));
        if (window.scrollY > 8) root.setAttribute("data-scrolled", "");
        else root.removeAttribute("data-scrolled");
        // Set on <html> (inherited), never on React-rendered elements, so hydration never sees a changed style.
        if (hero && !reduced) root.style.setProperty("--hs", String(Math.max(0, 1 - window.scrollY / 420)));
        // At the very bottom nothing more can scroll into view, so show whatever is left.
        if (max > 0 && window.scrollY >= max - 4 && root.classList.contains("reveal-ready")) {
          document.querySelectorAll(".landing :is(.reveal, .words, .stagger, .draw, .logo-rain):not([data-shown])").forEach((el) => el.setAttribute("data-shown", ""));
        }
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    let tilted: HTMLElement | null = null;
    let magnet: HTMLElement | null = null;
    function reset(el: HTMLElement | null, ...props: string[]) {
      if (!el) return;
      props.forEach((p) => el.style.removeProperty(p));
      el.classList.remove("is-tilting");
    }
    function onPointerMove(event: PointerEvent) {
      const target = event.target as Element | null;

      const card = target?.closest<HTMLElement>("[data-spotlight]");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--x", `${event.clientX - r.left}px`);
        card.style.setProperty("--y", `${event.clientY - r.top}px`);
      }
      if (reduced || event.pointerType !== "mouse") return;

      const tilt = target?.closest<HTMLElement>("[data-tilt]") ?? null;
      if (tilt !== tilted) reset(tilted, "--rx", "--ry");
      tilted = tilt;
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const x = (event.clientX - r.left) / r.width - 0.5;
        const y = (event.clientY - r.top) / r.height - 0.5;
        const strength = Number(tilt.dataset.tilt) || 6;
        tilt.classList.add("is-tilting");
        tilt.style.setProperty("--rx", `${(-y * strength).toFixed(2)}deg`);
        tilt.style.setProperty("--ry", `${(x * strength).toFixed(2)}deg`);
      }

      const mag = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (mag !== magnet) reset(magnet, "--mx", "--my");
      magnet = mag;
      if (mag) {
        const r = mag.getBoundingClientRect();
        mag.style.setProperty("--mx", `${((event.clientX - r.left - r.width / 2) * 0.3).toFixed(1)}px`);
        mag.style.setProperty("--my", `${((event.clientY - r.top - r.height / 2) * 0.4).toFixed(1)}px`);
      }

      if (hero && hero.contains(target)) {
        const r = hero.getBoundingClientRect();
        root.style.setProperty("--hx", `${event.clientX - r.left}px`);
        root.style.setProperty("--hy", `${event.clientY - r.top}px`);
        root.style.setProperty("--px", ((event.clientX - r.left) / r.width - 0.5).toFixed(3));
        root.style.setProperty("--py", ((event.clientY - r.top) / r.height - 0.5).toFixed(3));
      }
    }
    function onLeave() {
      reset(tilted, "--rx", "--ry");
      reset(magnet, "--mx", "--my");
      tilted = magnet = null;
    }
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      observer.disconnect();
      cancelAnimationFrame(frame);
      root.classList.remove("reveal-ready");
      root.removeAttribute("data-scrolled");
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [pathname]);
  return null;
}
