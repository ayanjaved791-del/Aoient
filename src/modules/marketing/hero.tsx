import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Logo } from "@/components/ui/logo";
import { AnimatedText } from "./animated-text";
import { ModuleIcon, type ModuleKey } from "./module-icons";

const WORDS = ["people", "customers", "projects", "time", "finances"];

/** Fixed positions (x %, y %, delay s) for the twinkling dots behind the hero. */
const SPARKS: [number, number, number][] = [
  [8, 18, 0], [16, 42, 1.1], [24, 9, 2.3], [31, 30, 0.6], [12, 62, 1.8], [88, 14, 0.3], [79, 36, 1.5],
  [93, 48, 2.6], [70, 10, 0.9], [84, 64, 2.1], [42, 6, 1.3], [60, 22, 2.8], [4, 34, 0.5], [96, 28, 1.9],
];

export function Hero() {
  return (
    <section data-hero className="group/hero relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-700 group-hover/hero:opacity-100"
        style={{ background: "radial-gradient(520px circle at var(--hx, 50%) var(--hy, 30%), rgb(168 85 247 / 0.14), transparent 60%)" }}
      />
      {SPARKS.map(([x, y, d], i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute size-1 rounded-full bg-violet-500 opacity-40 motion-safe:animate-twinkle dark:bg-violet-300"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}
        />
      ))}
      {/* Background: masked grid + drifting monochrome blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(0_0_0/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0/0.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)]"
      />
      <div aria-hidden className="pointer-events-none absolute -left-32 top-10 size-[420px] rounded-full bg-violet-300/40 blur-3xl motion-safe:animate-blob dark:bg-violet-600/25" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-40 size-[380px] rounded-full bg-orange-200/50 blur-3xl motion-safe:animate-blob dark:bg-fuchsia-600/20"
        style={{ animationDelay: "-9s" }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
        <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-xs font-medium text-neutral-700 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-300">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Early access · workspaces, roles &amp; invitations are live
        </p>

        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-5xl font-semibold tracking-tighter text-black sm:text-6xl lg:text-7xl dark:text-white">
          <AnimatedText text="One platform." trigger="load" delay={80} step={110} />
          <br />
          <span className="words words-load inline-block" style={{ "--d": "320ms" } as CSSProperties}>
            <span className="w bg-[linear-gradient(90deg,#7c3aed,#d946ef,#fb923c,#d946ef,#7c3aed)] bg-[length:200%_auto] bg-clip-text pb-2 text-transparent motion-safe:animate-shimmer dark:bg-[linear-gradient(90deg,#a78bfa,#e879f9,#fdba74,#e879f9,#a78bfa)]">
              Your entire business.
            </span>
          </span>
        </h1>

        <p
          className="animate-fade-up mx-auto mt-6 flex max-w-2xl flex-wrap items-baseline justify-center gap-x-1.5 text-lg text-neutral-600 sm:text-xl dark:text-neutral-400"
          style={{ animationDelay: "160ms" }}
        >
          <span>One connected workspace for your</span>
          <span className="sr-only">people, customers, projects, time and finances</span>
          <span aria-hidden className="relative inline-block h-[1.2em] overflow-hidden text-left align-bottom font-semibold leading-[1.2em] text-black dark:text-white">
            <span className="flex flex-col motion-safe:animate-word-cycle">
              {[...WORDS, WORDS[0]].map((w, i) => (
                <span key={i} className="h-[1.2em] bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-fuchsia-400">{w}</span>
              ))}
            </span>
          </span>
        </p>

        <div className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "240ms" }}>
          <Link
            href="/sign-up"
            data-magnetic
            className="shine group inline-flex h-11 items-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white shadow-[0_10px_30px_-8px_rgb(168_85_247/0.7)] transition-all hover:-translate-y-0.5 hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Create your workspace
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link
            href="/features"
            data-magnetic
            className="shine inline-flex h-11 items-center rounded-full border border-neutral-300 bg-white/60 px-6 text-sm font-medium text-black backdrop-blur transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950/60 dark:text-white dark:hover:bg-neutral-900"
          >
            See how it works
          </Link>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

const SIDEBAR: { key: ModuleKey; label: string; active?: boolean }[] = [
  { key: "organization", label: "Overview", active: true },
  { key: "people", label: "People" },
  { key: "crm", label: "CRM" },
  { key: "projects", label: "Projects" },
  { key: "time", label: "Time" },
  { key: "finance", label: "Finance" },
];

const BARS = [38, 62, 45, 80, 56, 92, 70, 84, 60, 96, 74, 88];

function ProductPreview() {
  return (
    <figure className="animate-rise-in relative mx-auto mt-16 max-w-5xl" style={{ animationDelay: "320ms" }}>
      <div aria-hidden className="absolute -inset-x-10 -bottom-10 top-10 rounded-[40px] bg-gradient-to-b from-neutral-300/60 to-transparent blur-2xl dark:from-neutral-700/40" />
      <div className="motion-safe:animate-float relative">
        <div
          aria-hidden
          data-parallax
          className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-[0_40px_80px_-24px_rgb(0_0_0/0.25)] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-[0_40px_80px_-24px_rgb(0_0_0/0.9)]"
        >
          {/* Window chrome */}
          <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <span className="size-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span className="size-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span className="size-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span className="mx-auto rounded-md bg-neutral-100 px-12 py-1 text-[11px] text-neutral-500 dark:bg-neutral-900">app.aoient.com/acme</span>
          </div>

          <div className="grid grid-cols-[auto_1fr]">
            <div className="hidden w-44 border-r border-neutral-200 p-3 sm:block dark:border-neutral-800">
              <Logo className="mb-4 px-2 [&_svg]:size-5" />
              <ul className="grid gap-0.5 text-[13px]">
                {SIDEBAR.map(({ key, label, active }) => (
                  <li
                    key={label}
                    className={
                      active
                        ? "flex items-center gap-2 rounded-md bg-neutral-100 px-2 py-1.5 font-medium text-black dark:bg-neutral-900 dark:text-white"
                        : "flex items-center gap-2 px-2 py-1.5 text-neutral-500"
                    }
                  >
                    <ModuleIcon module={key} size="xs" className="size-5 rounded-md shadow-sm [&_svg]:size-3" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid min-w-0 gap-3 p-3 sm:p-5">
              <div className="grid grid-cols-3 gap-3">
                {([
                  ["Billable hours", "1,284", "time"],
                  ["Open deals", "37", "crm"],
                  ["Invoices due", "$18.4k", "finance"],
                ] as const).map(([k, v, mod], i) => (
                  <div key={k} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                    <p className="flex items-center gap-1.5 truncate text-[11px] text-neutral-500">
                      <ModuleIcon module={mod} size="xs" className="size-4 rounded-[5px] shadow-none [&_svg]:size-2.5" />
                      {k}
                    </p>
                    <p className="animate-fade-up mt-1 text-lg font-semibold tabular-nums text-black sm:text-xl dark:text-white" style={{ animationDelay: `${700 + i * 120}ms` }}>
                      {v}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
                <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <p className="text-[11px] text-neutral-500">Hours logged per week</p>
                  <div className="mt-3 flex h-28 items-end gap-1.5">
                    {BARS.map((h, i) => (
                      <span
                        key={i}
                        className="flex-1 origin-bottom rounded-t-[3px] bg-gradient-to-t from-violet-600 to-fuchsia-400 motion-safe:animate-bar-grow dark:from-violet-500 dark:to-fuchsia-300"
                        style={{ height: `${h}%`, animationDelay: `${800 + i * 60}ms`, opacity: 0.45 + (h / 100) * 0.55 }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <p className="text-[11px] text-neutral-500">Projects board</p>
                  <div className="relative mt-3 grid grid-cols-3 gap-2">
                    {["To do", "Doing", "Done"].map((col) => (
                      <div key={col} className="min-h-24 rounded-lg bg-neutral-100 p-1.5 dark:bg-neutral-900">
                        <p className="mb-1.5 text-[10px] font-medium text-neutral-500">{col}</p>
                        <span className="block h-5 rounded bg-white shadow-xs dark:bg-neutral-800" />
                      </div>
                    ))}
                    <span className="absolute left-0 top-[52px] block h-5 w-[calc((100%-16px)/3)] px-1.5 motion-safe:animate-card-move">
                      <span className="block h-full rounded bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-md shadow-fuchsia-500/30" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="relative mt-5 text-xs text-neutral-500">
        Preview with sample data. People is live; CRM, Projects, Time and Finance are in development and will be released one by one.
      </figcaption>
    </figure>
  );
}
