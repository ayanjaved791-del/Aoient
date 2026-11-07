import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  CircleCheck,
  CreditCard,
  Database,
  KeyRound,
  ScrollText,
  ShieldCheck,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ModuleIcon, type ModuleKey } from "./module-icons";
import { AnimatedText } from "./animated-text";
import { BrandTile, PLANNED_INTEGRATIONS } from "./brand-logos";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { MobileMenu, NavLinks } from "./nav-links";
import { NAV } from "./nav-items";
import { HeaderAccount, HeaderAccountFallback } from "./header-account";


const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

export function LandingHeader() {
  return (
    <header className="landing-header animate-fade-up sticky top-0 z-40 border-b border-neutral-200/70 bg-white/75 backdrop-blur-xl dark:border-neutral-800/70 dark:bg-black/70">
      <div aria-hidden className="scroll-progress absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400" />
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
          <MobileMenu extra={[{ href: "/sign-in", label: "Sign in" }]} />
        </div>
      </div>
    </header>
  );
}

const MODULES: { key: ModuleKey; name: string; body: string; live?: boolean }[] = [
  { key: "organization", name: "Organization & access", body: "Workspaces, members, invitations, roles and the audit log.", live: true },
  { key: "people", name: "People", body: "Employee directory, departments, managers and time off." },
  { key: "crm", name: "CRM", body: "Leads, contacts, companies and a deal pipeline." },
  { key: "projects", name: "Projects", body: "Projects, tasks, milestones and boards — created straight from won deals." },
  { key: "time", name: "Time", body: "Timers, timesheets, approvals and billable hours." },
  { key: "finance", name: "Finance", body: "Invoices and expenses built from the work you delivered." },
  { key: "flow", name: "Flow", body: "Automations that move work between modules for you." },
  { key: "analytics", name: "Analytics", body: "Dashboards calculated from your real records — never invented." },
  { key: "documents", name: "Documents", body: "Proposals, contracts and files attached to the work they belong to." },
  { key: "inventory", name: "Inventory", body: "Products, stock levels and movements." },
  { key: "workspace", name: "Workspace", body: "Notes, wikis and shared team spaces." },
  { key: "connect", name: "Connect", body: "Integrations with the tools you already use." },
];

const LIVE_TODAY = ["Email sign-up", "Organizations", "Invitations", "Custom roles", "Audit log", "REST API"];

export function IntegrationMarquee() {
  const half = Math.ceil(PLANNED_INTEGRATIONS.length / 2);
  const row = (icons: typeof PLANNED_INTEGRATIONS, reverse: boolean) => (
    <div className="pause-on-hover flex w-max gap-3 motion-safe:animate-marquee" style={reverse ? { animationDirection: "reverse" } : undefined}>
      {[...icons, ...icons].map((icon, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-neutral-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-medium text-neutral-800 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
        >
          <BrandTile icon={icon} className="size-7 rounded-full shadow-none" glyphClassName="size-3.5" />
          {icon.title}
        </span>
      ))}
    </div>
  );
  return (
    <section aria-labelledby="integrations-heading" className="border-y border-neutral-200 bg-neutral-50 py-10 dark:border-neutral-900 dark:bg-neutral-950/50">
      <p id="integrations-heading" className="text-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
        Planned integrations · not connected yet
      </p>
      <p className="sr-only">{PLANNED_INTEGRATIONS.map((i) => i.title).join(", ")}</p>
      <div className="mt-6 grid gap-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        {row(PLANNED_INTEGRATIONS.slice(0, half), false)}
        {row(PLANNED_INTEGRATIONS.slice(half), true)}
      </div>
    </section>
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
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[640px] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-400/25 via-fuchsia-400/20 to-orange-300/25 blur-3xl motion-safe:animate-blob dark:from-violet-600/20 dark:via-fuchsia-600/15 dark:to-orange-500/15" />
      <div className="relative mx-auto max-w-3xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-400">
          <span className="size-1.5 rounded-full bg-gradient-to-r from-violet-500 to-orange-400" />
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
        <span className="size-1.5 rounded-full bg-gradient-to-r from-violet-500 to-orange-400" />
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

const FLOW: { key: ModuleKey; title: string; body: string }[] = [
  { key: "crm", title: "Win the deal", body: "A lead becomes a customer and a deal in CRM." },
  { key: "projects", title: "Start the project", body: "The won deal becomes a project — no re-typing." },
  { key: "people", title: "Staff the work", body: "Assign people and track their tasks." },
  { key: "time", title: "Capture time", body: "Billable hours roll up into project totals." },
  { key: "finance", title: "Invoice it", body: "Finance invoices the work that was delivered." },
  { key: "analytics", title: "See the business", body: "Analytics reads the same records. Nothing invented." },
];

export function WorkflowSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <SectionHeading
        eyebrow="The connected workflow"
        title="From first call to final invoice"
        body="Aoient is built around how service businesses actually work, so sales hands off to delivery without a spreadsheet in between."
      />
      <ol className="relative mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
        <span
          aria-hidden
          className="draw absolute left-[8%] right-[8%] top-7 hidden h-px bg-neutral-300 lg:block dark:bg-neutral-700"
        />
        <span
          aria-hidden
          className="absolute left-[8%] right-[8%] top-7 hidden h-px bg-[linear-gradient(90deg,transparent,#a855f7,#f97316,transparent)] bg-[length:50%_100%] bg-no-repeat motion-safe:animate-beam lg:block"
        />
        {FLOW.map(({ key, title, body }, i) => (
          <li key={title} data-reveal="scale" className="reveal group relative flex gap-4 lg:flex-col lg:items-center lg:text-center" style={delay(200 + i * 120)}>
            <span className="relative shrink-0 rounded-[20px] bg-white p-0 transition-transform duration-500 group-hover:-translate-y-1.5 group-hover:rotate-3 dark:bg-black">
              <ModuleIcon module={key} size="lg" />
              <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black text-[10px] font-semibold text-white dark:bg-white dark:text-black">
                <span className="absolute inset-0 rounded-full bg-violet-500 motion-safe:animate-ping-slow" style={{ animationDelay: `${i * 0.5}s` }} />
                <span className="relative">{i + 1}</span>
              </span>
            </span>
            <div>
              <p className="font-semibold text-black dark:text-white">{title}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="reveal mt-12 text-center text-sm text-neutral-500">
        The steps after “Win the deal” depend on modules that are still in development.
      </p>
    </section>
  );
}

export function ModulesSection({ more }: { more?: ReactNode } = {}) {
  return (
    <section id="modules" className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-950/40">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <SectionHeading
          eyebrow="Modules"
          title="Everything your business runs on"
          body="Turn on what you need today. Every module shares the same people, customers and projects."
        />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ key, name, body, live }, i) => (
            <li
              key={name}
              data-reveal={i === 0 ? "scale" : "flip"}
              className={cn("reveal", i === 0 && "sm:col-span-2 lg:row-span-2", i === MODULES.length - 1 && "sm:col-span-2")}
              style={delay((i % 4) * 90)}
            >
              <article
                data-spotlight
                data-tilt={i === 0 ? "3" : "8"}
                className={cn(
                  "group relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 hover:-translate-y-1",
                  live
                    ? "border-black bg-black text-white [--spot:255_255_255] dark:border-white dark:bg-white dark:text-black dark:[--spot:0_0_0]"
                    : "border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-black dark:hover:border-neutral-600",
                )}
              >
                {live && (
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent motion-safe:animate-sheen dark:via-black/10" />
                )}
                <div className="flex items-start justify-between gap-3">
                  <ModuleIcon
                    module={key}
                    className={cn("group-hover:motion-safe:animate-wiggle", live && "bg-white/10 text-white ring-white/20 dark:bg-black/5 dark:text-black dark:ring-black/15")}
                  />
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      live ? "bg-emerald-400 text-emerald-950" : "border border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700",
                    )}
                  >
                    {live ? "Live" : "In development"}
                  </span>
                </div>
                <h3 className={cn("mt-5 font-semibold", !live && "text-black dark:text-white")}>{name}</h3>
                <p className={cn("mt-1.5 text-sm leading-relaxed", live ? "text-white/70 dark:text-black/65" : "text-neutral-600 dark:text-neutral-400")}>{body}</p>
                {live && (
                  <ul className="stagger mt-auto grid gap-2 pt-6 text-sm sm:grid-cols-2">
                    {LIVE_TODAY.map((item) => (
                      <li key={item} className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 dark:border-black/10">
                        <CircleCheck className="size-4 shrink-0" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </li>
          ))}
        </ul>
        {more}
      </div>
    </section>
  );
}

const SECURITY = [
  { icon: ShieldCheck, tone: "text-emerald-400 bg-emerald-400/10 ring-emerald-400/30", title: "Isolated by default", body: "Every page and API call re-checks on the server that you belong to the organization. IDs sent by the browser are never trusted on their own.", span: "lg:col-span-2" },
  { icon: Database, tone: "text-sky-400 bg-sky-400/10 ring-sky-400/30", title: "Locked-down database", body: "Row-level security is on for every table, so the public browser key can't read or write anything directly.", span: "" },
  { icon: CreditCard, tone: "text-amber-300 bg-amber-300/10 ring-amber-300/30", title: "Honest payments", body: "Paid plans activate only from Paddle's signed server confirmation — never from a browser redirect.", span: "" },
  { icon: KeyRound, tone: "text-fuchsia-400 bg-fuchsia-400/10 ring-fuchsia-400/30", title: "Least privilege", body: "Custom roles can only bundle permissions their creator already holds.", span: "" },
  { icon: ScrollText, tone: "text-violet-400 bg-violet-400/10 ring-violet-400/30", title: "Every change on record", body: "Membership, role and settings changes are written to an audit log in the same transaction.", span: "lg:col-span-2" },
];

export function SecuritySection({ more, title = "Your data stays yours" }: { more?: ReactNode; title?: string } = {}) {
  return (
    <section id="security" className="scroll-mt-20 bg-black text-white dark:border-y dark:border-neutral-900 dark:bg-neutral-950">
      <div className="relative mx-auto max-w-6xl overflow-hidden px-4 py-24 sm:px-6 sm:py-32">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-80 w-[640px] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600/25 via-fuchsia-500/20 to-orange-400/20 blur-3xl" />
        <SectionHeading invert eyebrow="Security" title={title} body="Multi-tenant from the first line of code, with tests that try to read other companies' data and must fail." />
        <ul className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li data-reveal="scale" className="reveal sm:col-span-2 lg:col-span-1 lg:row-span-2">
            <div className="relative flex h-full min-h-72 flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <div className="relative flex size-36 items-center justify-center rounded-full border border-white/15">
                <span className="absolute inset-3 rounded-full border border-dashed border-white/20 motion-safe:animate-orbit" style={{ animationDuration: "30s" }} />
                <ShieldCheck className="size-14 text-emerald-400 drop-shadow-[0_0_18px_rgb(52_211_153/0.6)]" strokeWidth={1.25} aria-hidden />
                <span aria-hidden className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent motion-safe:animate-scan" />
              </div>
              <p className="mt-8 text-center text-sm text-neutral-400">Cross-tenant access attempts are part of the automated test suite.</p>
            </div>
          </li>
          {SECURITY.map(({ icon: Icon, tone, title, body, span }, i) => (
            <li key={title} data-reveal={i % 2 ? "left" : "right"} className={cn("reveal", span)} style={delay((i % 3) * 110)}>
              <article
                data-spotlight
                data-tilt="5"
                className="group h-full rounded-3xl border border-white/10 bg-white/[0.03] p-6 [--spot:255_255_255] hover:border-white/25"
              >
                <span className={cn("flex size-10 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6", tone)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{body}</p>
              </article>
            </li>
          ))}
        </ul>
        {more}
      </div>
    </section>
  );
}

const STEPS = [
  { icon: UserRoundPlus, tone: "from-sky-400 to-blue-600 shadow-blue-500/40", title: "Create your account", body: "Sign up and confirm your email address." },
  { icon: Building2, tone: "from-violet-400 to-purple-600 shadow-purple-500/40", title: "Set up your organization", body: "Pick a name and URL. You become its owner." },
  { icon: Users, tone: "from-fuchsia-400 to-pink-600 shadow-pink-500/40", title: "Invite your team", body: "Send invitations with the right role for each person." },
  { icon: CreditCard, tone: "from-emerald-400 to-green-600 shadow-emerald-500/40", title: "Choose a plan", body: "Monthly or yearly — switch whenever you need." },
];

export function StepsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <SectionHeading eyebrow="Get started" title="Up and running in minutes" body="No sales call, no setup project. These steps work today." />
      <div aria-hidden className="mx-auto mt-14 hidden h-1 max-w-6xl overflow-hidden rounded-full bg-neutral-100 lg:block dark:bg-neutral-900">
        <span className="draw block h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 via-60% to-emerald-500" />
      </div>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, tone, title, body }, i) => (
          <li key={title} data-reveal="flip" className="reveal" style={delay(i * 140)}>
            <article data-spotlight data-tilt="8" className="group h-full rounded-3xl border border-neutral-200 bg-white p-6 hover:border-neutral-300 hover:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.25)] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700">
              <div className="flex items-center justify-between">
                <span className="text-5xl font-semibold tracking-tighter text-neutral-200 transition-colors duration-500 group-hover:text-transparent group-hover:bg-gradient-to-br group-hover:from-violet-600 group-hover:to-orange-400 group-hover:bg-clip-text dark:text-neutral-800">
                  0{i + 1}
                </span>
                <span className={cn("flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25 group-hover:motion-safe:animate-wiggle", tone)}>
                  <Icon className="size-5" strokeWidth={2.25} aria-hidden />
                </span>
              </div>
              <h3 className="mt-6 font-semibold text-black dark:text-white">{title}</h3>
              <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FAQ = [
  {
    q: "What can I use today?",
    a: "Accounts with email verification, organizations, member invitations, owner/admin/member and custom roles, the audit log and the /api/v1 organization API. The business modules (People, CRM, Projects and the rest) are in development and are released one at a time.",
  },
  {
    q: "Who is Aoient for?",
    a: "Service businesses — agencies, studios and consultancies — that want sales, delivery, time and billing in one place instead of five disconnected tools.",
  },
  {
    q: "Can people from another company see my data?",
    a: "No. Every request checks on the server that you're an active member of the organization, the database blocks direct browser access, and automated tests try cross-company access on every change.",
  },
  {
    q: "How does billing work?",
    a: "Every new workspace gets a 14-day free trial, no card needed. Each plan is offered monthly or yearly, with yearly priced at ten months, and checkout runs through Paddle. A plan switches on automatically once Paddle's signed confirmation reaches our server, and plan limits are checked on the server.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every new workspace gets 14 days with the Medisea plan's limits, no card needed. Buying Medisea monthly starts with Paddle's 14-day free trial too, so the first payment covers you until 44 days after you subscribe.",
  },
  {
    q: "What happens when my trial ends?",
    a: "The workspace becomes read-only: your data stays and is still visible, but changes are paused until a plan is active. Nothing is deleted.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. Owners open Settings → Billing & plan → Manage subscription, which takes you to Paddle's customer portal. After cancelling you keep access until the end of the period you paid for.",
  },
  {
    q: "What limits does each plan have?",
    a: "Medisea: 5 users and 1 admin seat. Indiana: 15 users, 3 admin seats and custom roles. Pacfic-DeepDive: 40 users, 10 admin seats and custom roles. These are checked on the server today; project and automation limits apply when those modules are released.",
  },
  {
    q: "Does Aoient connect to Gmail, Slack or my other tools?",
    a: "Not yet. Integrations are planned and shown on our site as \"not connected yet\". We won't show an integration as working until it is.",
  },
  {
    q: "Can I invite clients or contractors?",
    a: "You can invite anyone with the Client / Guest role, which has no permissions by default. A proper client portal for sharing specific items is planned for a later release.",
  },
  {
    q: "Is there a dark mode?",
    a: "Yes. Aoient starts in the light theme, and you can switch to dark from the header or your account menu.",
  },
];

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
              className="faq-item reveal group rounded-2xl border border-neutral-200 bg-white px-5 transition-[border-color,box-shadow] duration-300 open:border-neutral-400 open:shadow-[0_16px_40px_-20px_rgb(124_58_237/0.35)] hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:open:border-neutral-600"
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
