import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Face, Sparkle, Squiggle, type FaceStyle } from "./doodles";
import { WaveIntro } from "./wave-intro";
import type { CSSProperties } from "react";

/** Wave timing for an element: when the front reaches it, and when it comes back. */
const t = (w: number, f: number) => ({ "--w": `${w}s`, "--f": `${f}s` }) as CSSProperties;

const ROLES: { face: FaceStyle; role: string; sees: string }[] = [
  { face: "bob", role: "Owner", sees: "everything" },
  { face: "glasses", role: "Admin", sees: "the team" },
  { face: "bun", role: "HR", sees: "people & leave" },
  { face: "spiky", role: "Employee", sees: "their own work" },
  { face: "cap", role: "Custom role", sees: "what you allow" },
];

/** Monochrome hero: big headline, two actions, role doodles and a black product preview. */
export function HomeHero() {
  return (
    <section data-hero className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <WaveIntro>
        <p style={t(0.55, 1.95)} className="wash-block animate-fade-up inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          <span className="size-1.5 rounded-full bg-black dark:bg-white" />
          Early access · People, roles and dashboards are live
        </p>

        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-[2.6rem] font-bold leading-[1.05] tracking-tighter text-black sm:text-6xl lg:text-7xl dark:text-white">
          <span className="wash-word inline-block" style={t(0.3, 1.15)}>Your</span>{" "}
          <span className="wash-word inline-block" style={t(0.5, 1.32)}>whole</span>{" "}
          <span className="wash-word inline-block" style={t(0.7, 1.5)}>business.</span>
          <br />
          <span className="wash-word inline-block" style={t(0.36, 1.22)}>One</span>{" "}
          <span className="wash-word relative inline-block" style={t(0.6, 1.42)}>
            quiet place.
            <Squiggle className="absolute -bottom-3 left-1/2 w-40 -translate-x-1/2 sm:-bottom-4 sm:w-56" />
          </span>
        </h1>

        <p className="wash-block animate-fade-up mx-auto mt-8 max-w-xl text-pretty text-lg text-neutral-600 sm:text-xl dark:text-neutral-400" style={{ animationDelay: "140ms", ...t(0.42, 1.9) }}>
          People, leave, roles and dashboards in one workspace, where everyone sees exactly what their role allows.
        </p>

        <div className="wash-block animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "220ms", ...t(0.48, 2.0) }}>
          <Link
            href="/sign-up"
            className="group inline-flex h-11 items-center gap-2 rounded-lg bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Get Aoient free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold text-black transition-colors hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900"
          >
            See pricing
          </Link>
        </div>
        <p className="wash-block animate-fade-up mt-3 text-xs text-neutral-500" style={{ animationDelay: "260ms", ...t(0.52, 2.05) }}>14-day free trial · no card needed to start</p>
        </WaveIntro>

        <ul className="animate-fade-up mx-auto mt-14 flex max-w-3xl flex-wrap items-end justify-center gap-x-6 gap-y-6 sm:gap-x-10" style={{ animationDelay: "320ms" }}>
          {ROLES.map((r, i) => (
            <li key={r.role} className="group flex w-24 flex-col items-center text-center">
              <Face variant={r.face} className={`size-14 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-4deg] sm:size-16 ${i % 2 ? "sm:mb-3" : ""}`} />
              <span className="mt-2 text-sm font-semibold text-black dark:text-white">{r.role}</span>
              <span className="text-xs text-neutral-500">sees {r.sees}</span>
            </li>
          ))}
        </ul>

        <ProductPreview />
      </div>
    </section>
  );
}

const BARS = [32, 48, 40, 64, 52, 78, 60, 72, 56, 88, 70, 82];
const OUT = [
  { name: "Hina Noor", what: "Annual leave · until Fri" },
  { name: "Omar Ali", what: "Sick leave · today" },
];

/** A black-and-white mock of the workspace (sample data), not a screenshot. */
function ProductPreview() {
  return (
    <figure className="animate-rise-in relative mx-auto mt-16 max-w-5xl" style={{ animationDelay: "420ms" }}>
      <Sparkle className="absolute -left-2 -top-6 hidden size-6 sm:block" />
      <Sparkle className="absolute -right-3 top-24 hidden size-5 sm:block" />
      <div
        aria-hidden
        data-parallax
        className="overflow-hidden rounded-2xl border border-neutral-800 bg-black text-left text-white shadow-[0_40px_80px_-30px_rgb(0_0_0/0.45)] dark:border-neutral-700"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/25" />
          <span className="size-2.5 rounded-full bg-white/25" />
          <span className="size-2.5 rounded-full bg-white/25" />
          <span className="mx-auto rounded-md bg-white/10 px-10 py-1 text-[11px] text-white/60">aoient.app/acme</span>
        </div>
        <div className="grid grid-cols-[auto_1fr]">
          <div className="hidden w-44 border-r border-white/10 p-3 sm:block">
            <Logo className="mb-5 px-2 text-white [&_svg]:size-5" />
            <ul className="grid gap-0.5 text-[13px]">
              {["Dashboard", "Directory", "Departments", "Leave", "Members", "Roles"].map((l, i) => (
                <li key={l} className={i === 0 ? "rounded-md bg-white/10 px-2 py-1.5 font-medium" : "px-2 py-1.5 text-white/55"}>{l}</li>
              ))}
            </ul>
          </div>
          <div className="grid min-w-0 gap-3 p-3 sm:p-5">
            <div className="grid grid-cols-3 gap-3">
              {[["Active people", "24"], ["On leave today", "2"], ["Leave to review", "3"]].map(([k, v], i) => (
                <div key={k} className="rounded-xl border border-white/10 p-3">
                  <p className="truncate text-[11px] text-white/55">{k}</p>
                  <p className="animate-fade-up mt-1 text-lg font-semibold tabular-nums sm:text-2xl" style={{ animationDelay: `${800 + i * 120}ms` }}>{v}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-[11px] text-white/55">Workspace activity</p>
                <div className="mt-3 flex h-28 items-end gap-1.5">
                  {BARS.map((h, i) => (
                    <span key={i} className="flex-1 origin-bottom rounded-t-[3px] bg-white motion-safe:animate-bar-grow" style={{ height: `${h}%`, opacity: 0.35 + (h / 100) * 0.65, animationDelay: `${900 + i * 50}ms` }} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-[11px] text-white/55">Out today</p>
                <ul className="mt-3 grid gap-2.5">
                  {OUT.map((o) => (
                    <li key={o.name} className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">{o.name.split(" ").map((p) => p[0]).join("")}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{o.name}</span>
                        <span className="block truncate text-[11px] text-white/55">{o.what}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 rounded-md border border-dashed border-white/20 px-2 py-1.5 text-[11px] text-white/55">Updates by itself, no refresh</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-5 text-xs text-neutral-500">Preview with sample data.</figcaption>
    </figure>
  );
}
