import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { AnimatedText } from "./animated-text";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { MobileMenu, NavLinks } from "./nav-links";
import { NAV } from "./nav-items";
import { HeaderAccount, HeaderAccountFallback } from "./header-account";
import { FAQ } from "./faq-data";


const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

export function LandingHeader() {
  return (
    <header className="landing-header animate-fade-up sticky top-0 z-40 border-b border-neutral-200/70 bg-white/75 backdrop-blur-xl dark:border-neutral-800/70 dark:bg-black/70">
      <div aria-hidden className="scroll-progress absolute inset-x-0 -bottom-px h-0.5 bg-black dark:bg-white" />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Aoient home" className="group/logo rounded-md">
          <Logo className="[&_svg]:transition-transform [&_svg]:duration-700 group-hover/logo:[&_svg]:rotate-[360deg]" />
        </Link>
        <NavLinks />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Suspense fallback={<HeaderAccountFallback />}>
            <HeaderAccount />
          </Suspense>
          <MobileMenu extra={[{ href: "/download", label: "Get the app" }, { href: "/sign-in", label: "Sign in" }]} />
        </div>
      </div>
    </header>
  );
}

/** Top of a marketing page: eyebrow, H1 that animates in on load, intro text. */
export function PageHero({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-neutral-200 dark:border-neutral-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(0_0_0/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0/0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_0%,black,transparent)] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)]"
      />
      <div className="relative mx-auto max-w-3xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-400">
          <span className="size-1.5 rounded-full bg-black dark:bg-white" />
          {eyebrow}
        </p>
        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tighter sm:text-6xl">
          <AnimatedText text={title} trigger="load" delay={80} step={70} />
        </h1>
        <p className="animate-fade-up mx-auto mt-5 max-w-2xl text-pretty text-lg text-neutral-600 dark:text-neutral-400" style={{ animationDelay: "260ms" }}>
          {body}
        </p>
        {children && <div className="animate-fade-up mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "360ms" }}>{children}</div>}
      </div>
    </section>
  );
}

/** "Learn more →" under a home-page section, pointing to that section's own page. */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p className="reveal mt-10 text-center">
      <Link
        href={href}
        className="group inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors hover:border-black hover:bg-neutral-100 dark:border-neutral-700 dark:hover:border-white dark:hover:bg-neutral-900"
      >
        {children}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </p>
  );
}

export function SectionHeading({ eyebrow, title, body, invert }: { eyebrow: string; title: string; body: string; invert?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p
        data-reveal="blur"
        className={cn(
          "reveal inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
          invert ? "border-white/15 text-neutral-300" : "border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400",
        )}
      >
        <span className="size-1.5 rounded-full bg-black dark:bg-white" />
        {eyebrow}
      </p>
      <h2 className={cn("mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-5xl", invert ? "text-white" : "text-black dark:text-white")}>
        <AnimatedText text={title} delay={120} />
      </h2>
      <p className={cn("reveal mt-4 text-pretty text-lg", invert ? "text-neutral-400" : "text-neutral-600 dark:text-neutral-400")} style={delay(300)}>
        {body}
      </p>
    </div>
  );
}

export function FaqSection({ limit, more }: { limit?: number; more?: ReactNode } = {}) {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-neutral-200 dark:border-neutral-900">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-[1fr_1.5fr]">
        <div data-reveal="left" className="reveal">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">FAQ</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-black sm:text-5xl dark:text-white">
            <AnimatedText text="Questions, answered" delay={150} />
          </h2>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Straight answers about what works today and what&apos;s coming.</p>
        </div>
        <div className="grid gap-3">
          {(limit ? FAQ.slice(0, limit) : FAQ).map(({ q, a }, i) => (
            <details
              key={q}
              data-reveal="right"
              className="faq-item reveal group rounded-2xl border border-neutral-200 bg-white px-5 transition-[border-color,box-shadow] duration-300 open:border-neutral-400 open:shadow-[0_16px_40px_-24px_rgb(0_0_0/0.3)] hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:open:border-neutral-600"
              style={delay(i * 90)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-black dark:text-white [&::-webkit-details-marker]:hidden">
                {q}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 transition-all duration-300 group-open:rotate-180 group-open:border-transparent group-open:bg-black group-open:text-white dark:border-neutral-800 dark:group-open:bg-white dark:group-open:text-black">
                  <ChevronDown className="size-4" aria-hidden />
                </span>
              </summary>
              <p className="animate-fade-up pb-5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{a}</p>
            </details>
          ))}
          {more}
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
      <div data-reveal="scale" className="reveal spin-border relative overflow-hidden rounded-[32px] [--card-bg:#0a0a0a] motion-safe:animate-spin-border dark:[--card-bg:#fafafa] [--spot:255_255_255] dark:[--spot:0_0_0]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] dark:bg-[radial-gradient(rgb(0_0_0/0.12)_1px,transparent_1px)]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="absolute size-[520px] rounded-full border-[3px] border-dotted border-white/30 motion-safe:animate-orbit sm:size-[640px] dark:border-black/25"
            style={{ animationDuration: "8s" }}
          >
            <span className="absolute left-1/2 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_16px_4px_rgb(217_70_239/0.6)]" />
          </span>
          <span
            className="absolute size-[380px] rounded-full border-2 border-dotted border-white/20 motion-safe:animate-orbit sm:size-[460px] dark:border-black/15"
            style={{ animationDuration: "6s", animationDirection: "reverse" }}
          >
            <span className="absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-orange-400 shadow-[0_0_12px_3px_rgb(251_146_60/0.6)]" />
          </span>
        </div>
        <div className="relative px-6 py-20 text-center text-white sm:py-24 dark:text-black">
          <h2 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            <AnimatedText text="Bring your whole business into one place." delay={250} step={70} />
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-white/65 dark:text-black/60">Create a workspace, invite your team and grow into each module as it ships.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              data-magnetic
              className="shine group inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 dark:bg-black dark:text-white"
            >
              Get started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              href="/sign-in"
              data-magnetic
              className="inline-flex h-11 items-center rounded-full border border-white/25 px-6 text-sm font-medium transition-colors hover:bg-white/10 dark:border-black/20 dark:hover:bg-black/5"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-900">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-neutral-600 dark:text-neutral-400">The business operating system for service companies.</p>
        </div>
        <nav aria-label="Product">
          <p className="text-sm font-semibold text-black dark:text-white">Product</p>
          <ul className="stagger mt-3 grid gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-block transition-all duration-300 hover:translate-x-1 hover:text-black dark:hover:text-white">{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Account">
          <p className="text-sm font-semibold text-black dark:text-white">Account</p>
          <ul className="stagger mt-3 grid gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li><Link href="/sign-up" className="inline-block transition-all duration-300 hover:translate-x-1 hover:text-black dark:hover:text-white">Create account</Link></li>
            <li><Link href="/sign-in" className="inline-block transition-all duration-300 hover:translate-x-1 hover:text-black dark:hover:text-white">Sign in</Link></li>
            <li><Link href="/forgot-password" className="inline-block transition-all duration-300 hover:translate-x-1 hover:text-black dark:hover:text-white">Reset password</Link></li>
            <li><Link href="/download" className="inline-block transition-all duration-300 hover:translate-x-1 hover:text-black dark:hover:text-white">Download the app</Link></li>
            <li><Link href="/terms" className="inline-block transition-all duration-300 hover:translate-x-1 hover:text-black dark:hover:text-white">Terms of Service</Link></li>
            <li><Link href="/privacy" className="inline-block transition-all duration-300 hover:translate-x-1 hover:text-black dark:hover:text-white">Privacy Policy</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-900">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-neutral-500 sm:px-6">© 2026 Aoient</p>
      </div>
      <p aria-hidden className="pointer-events-none select-none overflow-hidden text-center text-[22vw] font-semibold leading-[0.8] tracking-tighter text-neutral-100 dark:text-neutral-900">
        <AnimatedText text="Aoient" by="letter" step={90} wordClassName="bg-gradient-to-b from-neutral-200 to-neutral-50 bg-clip-text text-transparent dark:from-neutral-800 dark:to-neutral-950" />
      </p>
    </footer>
  );
}
