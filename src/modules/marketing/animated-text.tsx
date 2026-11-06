import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Splits text into words (or letters) that rise in one after another.
 * `trigger="scroll"` waits until the text scrolls into view; `"load"` plays immediately.
 * Screen readers get the plain text once, from a visually hidden copy.
 */
export function AnimatedText({
  text,
  by = "word",
  trigger = "scroll",
  delay = 0,
  step,
  className,
  wordClassName,
}: {
  text: string;
  by?: "word" | "letter";
  trigger?: "scroll" | "load";
  delay?: number;
  step?: number;
  className?: string;
  wordClassName?: string;
}) {
  const parts = by === "word" ? text.split(" ") : Array.from(text);
  const style = { "--d": `${delay}ms`, ...(step ? { "--step": `${step}ms` } : {}) } as CSSProperties;
  return (
    <span className={cn(trigger === "scroll" ? "words" : "words words-load", className)} style={style}>
      <span className="sr-only">{text}</span>
      {parts.map((part, i) => (
        <span key={i} aria-hidden className={cn("w", wordClassName)} style={{ "--i": i } as CSSProperties}>
          {part}
          {by === "word" && i < parts.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
