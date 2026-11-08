import { cn } from "@/lib/utils";

/**
 * Hand-drawn style faces, drawn as simple black line art (no images). Used
 * to give the monochrome pages some warmth.
 */
export type FaceStyle = "bob" | "spiky" | "bun" | "glasses" | "curly" | "cap";

const HAIR: Record<FaceStyle, React.ReactNode> = {
  bob: <path d="M17 47c-2-19 9-30 23-30s25 11 23 30c-3-9-6-12-9-14-6 4-17 5-29 2-4 3-6 7-8 12z" className="fill-current" />,
  spiky: <path d="M20 37l3-13 6 8 4-13 6 11 5-12 4 12 6-9 2 13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />,
  bun: (
    <>
      <circle cx="40" cy="14" r="7" className="fill-current" />
      <path d="M19 40c1-13 9-20 21-20s20 7 21 20c-6-6-13-8-21-8s-15 2-21 8z" className="fill-current" />
    </>
  ),
  glasses: (
    <>
      <path d="M22 33c3-9 10-13 18-13s15 4 18 13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="44" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="48" cy="44" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M38 44h4" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  curly: (
    <path
      d="M18 40c-3-4 0-9 4-9-1-5 4-9 8-7 1-5 8-7 11-3 3-4 10-3 11 2 5-1 9 4 7 8 4 1 5 7 2 9"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    />
  ),
  cap: (
    <>
      <path d="M19 36c0-12 9-19 21-19s21 7 21 19z" className="fill-current" />
      <path d="M58 36h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
};

export function Face({ variant, className, smile = true }: { variant: FaceStyle; className?: string; smile?: boolean }) {
  return (
    <svg viewBox="0 0 80 80" aria-hidden className={cn("text-black dark:text-white", className)}>
      <circle cx="40" cy="44" r="22" className="fill-white dark:fill-black" stroke="currentColor" strokeWidth="2.5" />
      {HAIR[variant]}
      {variant !== "glasses" && (
        <>
          <circle cx="32" cy="45" r="1.9" className="fill-current" />
          <circle cx="48" cy="45" r="1.9" className="fill-current" />
        </>
      )}
      {variant === "glasses" && (
        <>
          <circle cx="32" cy="44" r="1.6" className="fill-current" />
          <circle cx="48" cy="44" r="1.6" className="fill-current" />
        </>
      )}
      <path d={smile ? "M33 54c4 4 10 4 14 0" : "M34 55h12"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** A small hand-drawn squiggle or star for decoration. */
export function Squiggle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 24" aria-hidden className={cn("text-black dark:text-white", className)}>
      <path d="M2 14c10-10 18 10 28 0s18 10 28 0 18 10 28 0 18 10 28 0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("text-black dark:text-white", className)}>
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
