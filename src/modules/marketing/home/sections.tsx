import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Face, Squiggle } from "./doodles";

const d = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

/** Plain section heading: no eyebrow badge, just big black type. */
export function Heading({ title, body, invert, align = "center" }: { title: ReactNode; body?: string; invert?: boolean; align?: "center" | "left" }) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "")}>
      <h2 data-reveal="blur" className={cn("reveal text-balance text-3xl font-bold tracking-tight sm:text-5xl", invert ? "text-white dark:text-black" : "text-black dark:text-white")}>{title}</h2>
      {body && <p className={cn("reveal mt-4 text-pretty text-lg", invert ? "text-white/65 dark:text-black/60" : "text-neutral-600 dark:text-neutral-400")} style={d(120)}>{body}</p>}
    </div>
  );
}

const STACK = ["Supabase", "PostgreSQL", "Paddle", "Next.js", "Vercel", "Cloudflare Turnstile"];

/** Honest "built on" strip: the services Aoient actually runs on. Text only. */
export function BuiltOn() {
  return (
    <section aria-labelledby="built-on" className="border-y border-neutral-200 dark:border-neutral-900">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-10 sm:px-6 lg:flex-row lg:justify-between">
        <p id="built-on" className="shrink-0 text-sm text-neutral-500">Built on infrastructure you already trust</p>
        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 lg:justify-end">
          {STACK.map((s) => (
            <li key={s} className="text-base font-semibold tracking-tight text-neutral-400 transition-colors hover:text-black sm:text-lg dark:text-neutral-600 dark:hover:text-white">{s}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "1", title: "Create your workspace", body: "Sign up, name your company and pick its web address. You're the owner." },
  { n: "2", title: "Add your people", body: "Add employees to the directory. Invite them with a link, or give them a login yourself." },
  { n: "3", title: "Let everyone work", body: "Each person signs in to their own view: leave, profile, team, all kept live." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <Heading title="Up and running in an afternoon" body="No sales call and no setup project. These steps work today." />
      <ol className="mt-14 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.n} data-reveal="scale" className="reveal rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800" style={d(i * 100)}>
            <span className="flex size-10 items-center justify-center rounded-full border-2 border-black text-sm font-bold dark:border-white">{s.n}</span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const MODULES: { name: string; body: string; live?: boolean }[] = [
  { name: "Organization & access", body: "Workspaces, members, invitations, roles, audit log.", live: true },
  { name: "People", body: "Directory, departments, managers, private details, leave.", live: true },
  { name: "Dashboards", body: "A live dashboard for each role, from real records.", live: true },
  { name: "CRM", body: "Leads, contacts, companies and deals." },
  { name: "Projects", body: "Projects, tasks and boards from won deals." },
  { name: "Time", body: "Timers, timesheets and billable hours." },
  { name: "Finance", body: "Invoices and expenses from delivered work." },
  { name: "Documents", body: "Proposals, contracts and files." },
  { name: "Flow", body: "Automations between modules." },
  { name: "Connect", body: "Integrations with tools you use." },
];

/** The black band: every module, clearly marked live or coming. */
export function ModulesBand({ more }: { more?: ReactNode }) {
  return (
    <section className="bg-black text-white dark:bg-white dark:text-black">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <Heading align="left" invert title="One system. Every part of the business." body="Turn on what you need today and grow into each module as it ships. Three are live now." />
            <Squiggle className="mt-8 w-40 text-white dark:text-black" />
            {more && <div className="mt-8">{more}</div>}
          </div>
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 sm:grid-cols-2 dark:border-black/15 dark:bg-black/15">
            {MODULES.map((m, i) => (
              <li key={m.name} data-reveal="blur" className="reveal bg-black p-5 dark:bg-white" style={d(i * 50)}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{m.name}</h3>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", m.live ? "bg-white text-black dark:bg-black dark:text-white" : "border border-dashed border-white/30 text-white/60 dark:border-black/30 dark:text-black/60")}>
                    {m.live ? "Live" : "Soon"}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-white/60 dark:text-black/60">{m.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Small link button used under sections. */
export function TextLink({ href, children, invert }: { href: string; children: ReactNode; invert?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline", invert ? "text-white dark:text-black" : "text-black dark:text-white")}>
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
      <div data-reveal="scale" className="reveal relative overflow-hidden rounded-3xl bg-black px-6 py-16 text-center text-white sm:py-20 dark:bg-white dark:text-black">
        <div className="flex justify-center -space-x-3">
          {(["curly", "bob", "glasses", "spiky"] as const).map((f) => (
            <Face key={f} variant={f} className="size-14 sm:size-16" />
          ))}
        </div>
        <h2 className="mx-auto mt-8 max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">Bring your team into one place.</h2>
        <p className="mx-auto mt-5 max-w-lg text-white/65 dark:text-black/60">Create a workspace in minutes. Your 14-day trial starts right away.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className="group inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-black transition-colors hover:bg-neutral-200 dark:bg-black dark:text-white dark:hover:bg-neutral-800">
            Get Aoient free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link href="/sign-in" className="inline-flex h-11 items-center rounded-lg border border-white/25 px-5 text-sm font-semibold transition-colors hover:bg-white/10 dark:border-black/20 dark:hover:bg-black/5">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
