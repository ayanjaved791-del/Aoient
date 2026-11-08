"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

const TOTAL_MS = 3000;

/**
 * Opening effect for the home hero: a big wave rolls in from the left,
 * washes the hero text away to the right, and once it has passed the
 * headline words drop back into place from above.
 *
 * Progressive enhancement: the text is plain, visible HTML. The effect only
 * runs after hydration, when the tab is visible and the visitor hasn't asked
 * for reduced motion. Elements opt in with the `wash-word` / `wash-block`
 * classes and a `--i` order; the timing lives in globals.css.
 */
export function WaveIntro({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState !== "visible") return;
    const el = ref.current;
    if (!el) return;
    // Start on the next frame so the browser has painted the text first.
    const start = requestAnimationFrame(() => {
      el.classList.add("wave-intro");
      setPlaying(true);
    });
    const stop = window.setTimeout(() => {
      // Mark as done rather than just removing the class: otherwise the
      // elements' own load-in animations would replay and blink.
      el.classList.replace("wave-intro", "wave-done");
      setPlaying(false);
    }, TOTAL_MS);
    return () => {
      cancelAnimationFrame(start);
      window.clearTimeout(stop);
      el.classList.remove("wave-intro");
    };
  }, []);

  return (
    <div ref={ref}>
      {children}
      {playing && <Wave />}
    </div>
  );
}

/** The wave itself: an ocean-blue body with a curling crest, foam and spray. */
function Wave() {
  // Front edge of the wave, crest at the top curling back over itself.
  const FRONT = "M440 0C560 -5 655 30 688 105C705 145 695 185 662 192C640 197 626 182 634 166C590 210 585 300 615 400C640 490 600 590 630 690C655 780 615 880 645 1000";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <div className="wave-sweep absolute inset-y-0 left-0 w-[max(60vw,520px)] will-change-transform">
        <svg viewBox="0 0 700 1000" preserveAspectRatio="none" className="wave-bob absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="wv-body" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#031d3a" />
              <stop offset="0.45" stopColor="#063a6b" />
              <stop offset="0.75" stopColor="#0c5c9c" />
              <stop offset="0.92" stopColor="#1784c4" />
              <stop offset="1" stopColor="#2aa3dc" />
            </linearGradient>
            <linearGradient id="wv-depth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7fdcf5" stopOpacity="0.35" />
              <stop offset="0.35" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="1" stopColor="#010f22" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="wv-face" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#1a8fd0" stopOpacity="0" />
              <stop offset="0.6" stopColor="#3cb9e6" stopOpacity="0.55" />
              <stop offset="1" stopColor="#8fe3f7" stopOpacity="0.85" />
            </linearGradient>
            <radialGradient id="wv-glow" cx="0.9" cy="0.13" r="0.22">
              <stop offset="0" stopColor="#b8f1ff" stopOpacity="0.75" />
              <stop offset="1" stopColor="#b8f1ff" stopOpacity="0" />
            </radialGradient>
            <filter id="wv-foam" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" />
              <feDisplacementMap in="SourceGraphic" scale="16" />
            </filter>
          </defs>

          {/* A lighter swell rolling just behind the main wave. */}
          <path d="M0 60H400C480 60 560 110 575 190C590 265 545 320 495 312C470 420 520 520 540 610C560 700 520 800 545 1000H0Z" fill="#3aa6d6" opacity="0.45" />

          {/* Body, then light from above and shadow toward the bottom. */}
          <path d={`M0 0H440${FRONT.slice(6)}H0Z`} fill="url(#wv-body)" />
          <path d={`M0 0H440${FRONT.slice(6)}H0Z`} fill="url(#wv-depth)" />
          {/* Thin, brighter water along the front face. */}
          <path d={`${FRONT}H575C545 880 585 780 560 690C535 590 575 490 548 400C520 300 540 220 600 150C560 90 500 60 440 40Z`} fill="url(#wv-face)" />
          {/* The hollow under the curling lip, and sunlight through the crest. */}
          <path d="M634 166C600 200 592 255 604 310C622 255 648 218 662 192C648 196 638 186 634 166Z" fill="#021a33" opacity="0.55" />
          <rect width="700" height="1000" fill="url(#wv-glow)" />

          {/* Currents inside the water. */}
          <g fill="none" strokeLinecap="round" stroke="#bdefff" strokeOpacity="0.16" strokeWidth="5">
            <path d="M380 120C460 140 500 200 480 270C460 350 520 430 540 520" />
            <path d="M300 260C360 300 380 380 370 450C360 540 420 610 440 700" />
            <path d="M200 420C250 470 260 540 250 610C240 690 290 760 300 860" />
            <path d="M110 150C160 200 170 260 160 330" />
            <path d="M420 600C460 660 450 740 470 820" />
          </g>

          {/* Foam: a rough white band along the crest and the front, plus bubbles. */}
          <g filter="url(#wv-foam)">
            <path d={FRONT} fill="none" stroke="#9fd9f0" strokeWidth="26" strokeLinecap="round" opacity="0.7" />
            <path d={FRONT} fill="none" stroke="#f4fcff" strokeWidth="14" strokeLinecap="round" />
            <path d="M400 6C520 0 630 25 680 95" fill="none" stroke="#ffffff" strokeWidth="22" strokeLinecap="round" />
            <g fill="#ffffff">
              <circle cx="610" cy="40" r="16" />
              <circle cx="660" cy="80" r="13" />
              <circle cx="560" cy="18" r="11" />
              <circle cx="690" cy="140" r="9" />
              <circle cx="640" cy="200" r="8" />
              <circle cx="618" cy="420" r="9" />
              <circle cx="646" cy="600" r="8" />
              <circle cx="634" cy="760" r="10" />
              <circle cx="651" cy="900" r="8" />
            </g>
          </g>
          <g fill="#e9f9ff" opacity="0.7">
            <circle cx="545" cy="330" r="3" /><circle cx="590" cy="520" r="4" /><circle cx="575" cy="690" r="3" />
            <circle cx="600" cy="850" r="4" /><circle cx="520" cy="120" r="3" /><circle cx="470" cy="60" r="4" />
          </g>
        </svg>
        {/* Spray thrown ahead of the crest. */}
        <span className="wave-spray absolute right-[2%] top-[8%] size-3 rounded-full bg-sky-100 [--sx:60px] [--sy:-40px]" />
        <span className="wave-spray absolute right-[4%] top-[14%] size-2 rounded-full bg-white [--sx:90px] [--sy:-10px] [animation-delay:120ms]" />
        <span className="wave-spray absolute right-[1%] top-[22%] size-2.5 rounded-full bg-sky-200 [--sx:70px] [--sy:20px] [animation-delay:240ms]" />
        <span className="wave-spray absolute right-[3%] top-[40%] size-2 rounded-full bg-white [--sx:80px] [--sy:-20px] [animation-delay:360ms]" />
        <span className="wave-spray absolute right-[2%] top-[62%] size-3 rounded-full bg-sky-100 [--sx:60px] [--sy:10px] [animation-delay:180ms]" />
        <span className="wave-spray absolute right-[5%] top-[30%] size-1.5 rounded-full bg-white [--sx:110px] [--sy:-30px] [animation-delay:300ms]" />
      </div>
    </div>
  );
}
