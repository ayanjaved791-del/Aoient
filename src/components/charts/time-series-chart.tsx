"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface ChartPoint { day: string; value: number }

const HEIGHT = 200;
const PAD = { top: 16, right: 16, bottom: 26, left: 32 };

const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

/** Smallest "nice" integer ceiling (1, 2, 5, 10, 20, 50…) at or above max, with room for headroom. */
function niceMax(max: number): number {
  if (max <= 4) return Math.max(max, 1) <= 2 ? 2 : 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 2.5, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

/**
 * Single-series daily chart (area for levels, bars for counts) with a hover /
 * keyboard readout and a table view, so no value is reachable only by hovering.
 */
export function TimeSeriesChart({
  data,
  kind,
  valueLabel,
  unit,
}: {
  data: ChartPoint[];
  kind: "area" | "bar";
  /** Names the measure in the tooltip and the table header, e.g. "Members". */
  valueLabel: string;
  /** Singular/plural noun for the tooltip, e.g. ["event", "events"]. */
  unit: [string, string];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const band = innerW / Math.max(n, 1);
  const x = (i: number) => (kind === "bar" ? PAD.left + band * i + band / 2 : PAD.left + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1)));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max].filter((t, i, a) => Number.isInteger(t) && a.indexOf(t) === i);
  if (!ticks.includes(max)) ticks.push(max);
  const xLabels = n > 0 ? [...new Set([0, Math.floor((n - 1) / 2), n - 1])] : [];

  function indexAt(clientX: number) {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    if (kind === "bar") return Math.min(n - 1, Math.max(0, Math.floor((px - PAD.left) / band)));
    return Math.min(n - 1, Math.max(0, Math.round(((px - PAD.left) / innerW) * (n - 1))));
  }
  const onMove = (e: PointerEvent) => n && setActive(indexAt(e.clientX));
  const onKey = (e: KeyboardEvent) => {
    if (!n) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((i) => Math.min(n - 1, Math.max(0, (i ?? n - 1) + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
  };

  const linePath = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const areaPath = n ? `${linePath}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const barW = Math.max(2, Math.min(24, band - 2));
  const last = n ? data[n - 1] : null;
  const shown = active !== null ? data[active] : null;
  const noun = (v: number) => (v === 1 ? unit[0] : unit[1]);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative touch-pan-y select-none outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="img"
        aria-labelledby={titleId}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((i) => i ?? n - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        <span id={titleId} className="sr-only">
          {`${valueLabel} per day, ${n} days. Latest: ${last?.value ?? 0}. Use the arrow keys to read each day, or open the table below.`}
        </span>
        <svg width={width} height={HEIGHT} className="block max-w-full overflow-visible" aria-hidden>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{t}</text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text key={i} x={x(i)} y={HEIGHT - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">
              {fmtDay(data[i].day)}
            </text>
          ))}

          {kind === "area" ? (
            <>
              <path d={areaPath} fill="var(--primary)" fillOpacity={0.1} />
              <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {active !== null && (
                <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke="var(--muted-foreground)" strokeWidth={1} />
              )}
              {last && active === null && (
                <>
                  <circle cx={x(n - 1)} cy={y(last.value)} r={4} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
                  <text x={x(n - 1)} y={y(last.value) - 10} textAnchor="end" className="fill-foreground text-[12px] font-semibold">{last.value}</text>
                </>
              )}
              {shown && active !== null && <circle cx={x(active)} cy={y(shown.value)} r={5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />}
            </>
          ) : (
            data.map((d, i) => {
              if (d.value <= 0) return null;
              const top = y(d.value);
              const h = y(0) - top;
              const r = Math.min(4, h, barW / 2);
              const left = x(i) - barW / 2;
              return (
                <path
                  key={d.day}
                  d={`M${left},${y(0)}V${top + r}Q${left},${top} ${left + r},${top}H${left + barW - r}Q${left + barW},${top} ${left + barW},${top + r}V${y(0)}Z`}
                  fill="var(--primary)"
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              );
            })
          )}
        </svg>

        {shown && active !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(x(active), 70), width - 70) }}
          >
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 rounded-full bg-primary" aria-hidden />
              <span className="font-semibold text-foreground">{shown.value}</span>
              <span className="text-muted-foreground">{noun(shown.value)}</span>
            </p>
            <p className="mt-0.5 text-muted-foreground">{fmtDay(shown.day, { weekday: "short", month: "short", day: "numeric" })}</p>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs">
        <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-muted">
              <tr><th scope="col" className="px-3 py-1.5 font-medium">Day</th><th scope="col" className="px-3 py-1.5 text-right font-medium">{valueLabel}</th></tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td className="px-3 py-1.5">{fmtDay(d.day, { weekday: "short", month: "short", day: "numeric" })}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
