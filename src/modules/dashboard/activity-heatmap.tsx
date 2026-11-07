"use client";
import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEVELS = [0, 0.18, 0.38, 0.62, 1];
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

/** Single-hue intensity: an empty cell is the muted surface; more events, more of the accent. */
function level(n: number, max: number) {
  if (n <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((n / max) * 4)));
}

/** When the team works: changes by weekday and hour, with a keyboard/hover readout and a table view. */
export function ActivityHeatmap({ grid, timezone }: { grid: number[][]; timezone: string }) {
  const max = Math.max(0, ...grid.flat());
  const [active, setActive] = useState<[number, number] | null>(null);
  const busiest = (() => {
    let best: [number, number, number] = [0, 0, 0];
    grid.forEach((row, d) => row.forEach((n, h) => { if (n > best[2]) best = [d, h, n]; }));
    return best;
  })();
  const readout = active
    ? `${DAYS[active[0]]} ${hourLabel(active[1])}–${hourLabel((active[1] + 1) % 24)}: ${grid[active[0]][active[1]]} ${grid[active[0]][active[1]] === 1 ? "change" : "changes"}`
    : max > 0
      ? `Busiest: ${DAYS[busiest[0]]} around ${hourLabel(busiest[1])} (${busiest[2]})`
      : "No changes recorded in this period";

  function onKey(e: KeyboardEvent) {
    const [d, h] = active ?? [0, 0];
    const moves: Record<string, [number, number]> = { ArrowRight: [d, Math.min(23, h + 1)], ArrowLeft: [d, Math.max(0, h - 1)], ArrowDown: [Math.min(6, d + 1), h], ArrowUp: [Math.max(0, d - 1), h] };
    if (moves[e.key]) { e.preventDefault(); setActive(moves[e.key]); }
  }

  return (
    <div>
      <div
        tabIndex={0}
        role="img"
        aria-label={`Changes by weekday and hour in ${timezone}. ${readout}. Use the arrow keys to read each hour, or open the table below.`}
        onKeyDown={onKey}
        onFocus={() => setActive((a) => a ?? [busiest[0], busiest[1]])}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        className="scroll-thin overflow-x-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="grid min-w-[520px] grid-cols-[32px_repeat(24,minmax(0,1fr))] gap-[3px]" aria-hidden>
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <span className="pr-1 text-right text-[11px] leading-[18px] text-muted-foreground">{DAYS[d]}</span>
              {row.map((n, h) => {
                const lv = level(n, max);
                const on = active && active[0] === d && active[1] === h;
                return (
                  <span
                    key={h}
                    onPointerEnter={() => setActive([d, h])}
                    className={cn("h-[18px] rounded-[4px] transition-transform", lv === 0 && "bg-surface-muted", on && "scale-110 ring-2 ring-foreground/70")}
                    style={lv ? { backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(LEVELS[lv] * 100)}%, var(--surface))` } : undefined}
                  />
                );
              })}
            </div>
          ))}
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[10px] text-muted-foreground">{h % 6 === 0 ? hourLabel(h) : ""}</span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-medium text-secondary-foreground" aria-live="polite">{readout}</p>
        <div className="flex items-center gap-1 text-muted-foreground" aria-hidden>
          Less
          {[0, 1, 2, 3, 4].map((lv) => (
            <span key={lv} className={cn("size-3 rounded-[3px]", lv === 0 && "bg-surface-muted")}
              style={lv ? { backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(LEVELS[lv] * 100)}%, var(--surface))` } : undefined} />
          ))}
          More
        </div>
      </div>
      <details className="mt-2 text-xs">
        <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
        <div className="scroll-thin mt-2 max-h-56 overflow-auto rounded-md border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-muted">
              <tr><th scope="col" className="px-3 py-1.5 font-medium">Day</th><th scope="col" className="px-3 py-1.5 font-medium">Hour</th><th scope="col" className="px-3 py-1.5 text-right font-medium">Changes</th></tr>
            </thead>
            <tbody>
              {grid.flatMap((row, d) => row.map((n, h) => ({ d, h, n }))).filter((c) => c.n > 0).sort((a, b) => b.n - a.n).map((c) => (
                <tr key={`${c.d}-${c.h}`} className="border-t border-border">
                  <td className="px-3 py-1.5">{DAYS[c.d]}</td><td className="px-3 py-1.5">{hourLabel(c.h)}–{hourLabel((c.h + 1) % 24)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
