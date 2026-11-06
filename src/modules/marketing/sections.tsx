import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  Boxes,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  CircleCheck,
  Clock3,
  CreditCard,
  Database,
  FileText,
  FolderKanban,
  Handshake,
  KeyRound,
  LayoutGrid,
  Menu,
  Plug,
  Receipt,
  ScrollText,
  ShieldCheck,
  UserRoundPlus,
  Users,
  Workflow,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#modules", label: "Modules" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/75 backdrop-blur-xl dark:border-neutral-800/70 dark:bg-black/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Aoient home" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="hidden h-9 items-center rounded-full px-3 text-sm font-medium text-neutral-700 transition-colors hover:text-black sm:inline-flex dark:text-neutral-300 dark:hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-9 items-center rounded-full bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Get started
          </Link>
          <details className="group relative md:hidden">
            <summary
              aria-label="Open menu"
              className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-4" aria-hidden />
            </summary>
            <nav
              aria-label="Sections"
              className="animate-fade-up absolute right-0 top-11 grid w-48 gap-0.5 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
            >
              {[...NAV, { href: "/sign-in", label: "Sign in" }].map((item) => (
                <a key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900">
                  {item.label}
                </a>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

const MODULES = [
  { icon: Building2, name: "Organization & access", body: "Workspaces, members, invitations, roles and the audit log.", live: true },
  { icon: Users, name: "People", body: "Employee directory, departments, managers and time off." },
  { icon: Handshake, name: "CRM", body: "Leads, contacts, companies and a deal pipeline." },
  { icon: FolderKanban, name: "Projects", body: "Projects, tasks, milestones and boards — created straight from won deals." },
  { icon: Clock3, name: "Time", body: "Timers, timesheets, approvals and billable hours." },
  { icon: Receipt, name: "Finance", body: "Invoices and expenses built from the work you delivered." },
  { icon: Workflow, name: "Flow", body: "Automations that move work between modules for you." },
  { icon: ChartNoAxesCombined, name: "Analytics", body: "Dashboards calculated from your real records — never invented." },
  { icon: FileText, name: "Documents", body: "Proposals, contracts and files attached to the work they belong to." },
  { icon: Boxes, name: "Inventory", body: "Products, stock levels and movements." },
  { icon: LayoutGrid, name: "Workspace", body: "Notes, wikis and shared team spaces." },
  { icon: Plug, name: "Connect", body: "Integrations with the tools you already use." },
];

const LIVE_TODAY = ["Email sign-up", "Organizations", "Invitations", "Custom roles", "Audit log", "REST API"];

export function ModuleMarquee() {
  const row = (reverse: boolean) => (
    <div className="flex w-max gap-3 motion-safe:animate-marquee" style={reverse ? { animationDirection: "reverse" } : undefined}>
      {[...MODULES, ...MODULES].map(({ icon: Icon, name }, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
        >
          <Icon className="size-4" aria-hidden />
          {name}
        </span>
      ))}
    </div>
  );
  return (
    <section aria-label="Modules" className="border-y border-neutral-200 bg-neutral-50 py-10 dark:border-neutral-900 dark:bg-neutral-950/50">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Twelve building blocks · one workspace</p>
      <div aria-hidden className="mt-6 grid gap-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, body, invert }: { eyebrow: string; title: string; body: string; invert?: boolean }) {
  return (
    <div className="reveal mx-auto max-w-2xl text-center">
      <p className={cn("text-xs font-semibold uppercase tracking-[0.2em]", invert ? "text-neutral-400" : "text-neutral-500")}>{eyebrow}</p>
      <h2 className={cn("mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-5xl", invert ? "text-white" : "text-black dark:text-white")}>{title}</h2>
      <p className={cn("mt-4 text-pretty text-lg", invert ? "text-neutral-400" : "text-neutral-600 dark:text-neutral-400")}>{body}</p>
    </div>
  );
}

const FLOW = [
  { icon: Handshake, title: "Win the deal", body: "A lead becomes a customer and a deal in CRM." },
  { icon: FolderKanban, title: "Start the project", body: "The won deal becomes a project — no re-typing." },
  { icon: Users, title: "Staff the work", body: "Assign people and track their tasks." },
  { icon: Clock3, title: "Capture time", body: "Billable hours roll up into project totals." },
  { icon: Receipt, title: "Invoice it", body: "Finance invoices the work that was delivered." },
  { icon: ChartNoAxesCombined, title: "See the business", body: "Analytics reads the same records. Nothing invented." },
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
          className="absolute left-[8%] right-[8%] top-7 hidden h-px bg-neutral-200 lg:block dark:bg-neutral-800"
        />
        <span
          aria-hidden
          className="absolute left-[8%] right-[8%] top-7 hidden h-px bg-[linear-gradient(90deg,transparent,rgb(var(--spot)/0.9),transparent)] bg-[length:50%_100%] bg-no-repeat motion-safe:animate-beam lg:block"
        />
        {FLOW.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="reveal group relative flex gap-4 lg:flex-col lg:items-center lg:text-center" style={delay(i * 90)}>
            <span className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white transition-all duration-500 group-hover:-translate-y-1 group-hover:bg-black group-hover:text-white dark:border-neutral-800 dark:bg-neutral-950 dark:group-hover:bg-white dark:group-hover:text-black">
              <Icon className="size-5" aria-hidden />
              <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black text-[10px] font-semibold text-white dark:bg-white dark:text-black">
                {i + 1}
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

export function ModulesSection() {
  return (
    <section id="modules" className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-950/40">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <SectionHeading
          eyebrow="Modules"
          title="Everything your business runs on"
          body="Turn on what you need today. Every module shares the same people, customers and projects."
        />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ icon: Icon, name, body, live }, i) => (
            <li
              key={name}
              className={cn("reveal", i === 0 && "sm:col-span-2 lg:row-span-2", i === MODULES.length - 1 && "sm:col-span-2")}
              style={delay((i % 4) * 80)}
            >
              <article
                data-spotlight
                className={cn(
                  "group flex h-full flex-col rounded-3xl border p-6 transition-[transform,border-color] duration-500 hover:-translate-y-1",
                  live
                    ? "border-black bg-black text-white [--spot:255_255_255] dark:border-white dark:bg-white dark:text-black dark:[--spot:0_0_0]"
                    : "border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-black dark:hover:border-neutral-600",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl border transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110",
                      live ? "border-white/20 bg-white/10 dark:border-black/15 dark:bg-black/5" : "border-neutral-200 dark:border-neutral-800",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      live ? "bg-white text-black dark:bg-black dark:text-white" : "border border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700",
                    )}
                  >
                    {live ? "Live" : "In development"}
                  </span>
                </div>
                <h3 className={cn("mt-5 font-semibold", !live && "text-black dark:text-white")}>{name}</h3>
                <p className={cn("mt-1.5 text-sm leading-relaxed", live ? "text-white/70 dark:text-black/65" : "text-neutral-600 dark:text-neutral-400")}>{body}</p>
                {live && (
                  <ul className="mt-auto grid gap-2 pt-6 text-sm sm:grid-cols-2">
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
      </div>
    </section>
  );
}

const SECURITY = [
  { icon: ShieldCheck, title: "Isolated by default", body: "Every page and API call re-checks on the server that you belong to the organization. IDs sent by the browser are never trusted on their own.", span: "lg:col-span-2" },
  { icon: Database, title: "Locked-down database", body: "Row-level security is on for every table, so the public browser key can't read or write anything directly.", span: "" },
  { icon: CreditCard, title: "Honest payments", body: "Paid plans will only activate from Paddle's signed server confirmation — never from a browser redirect.", span: "" },
  { icon: KeyRound, title: "Least privilege", body: "Custom roles can only bundle permissions their creator already holds.", span: "" },
  { icon: ScrollText, title: "Every change on record", body: "Membership, role and settings changes are written to an audit log in the same transaction.", span: "lg:col-span-2" },
];

export function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-20 bg-black text-white dark:border-y dark:border-neutral-900 dark:bg-neutral-950">
      <div className="relative mx-auto max-w-6xl overflow-hidden px-4 py-24 sm:px-6 sm:py-32">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-80 w-[640px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <SectionHeading invert eyebrow="Security" title="Your data stays yours" body="Multi-tenant from the first line of code, with tests that try to read other companies' data and must fail." />
        <ul className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li className="reveal sm:col-span-2 lg:col-span-1 lg:row-span-2">
            <div className="relative flex h-full min-h-72 flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <div className="relative flex size-36 items-center justify-center rounded-full border border-white/15">
                <span className="absolute inset-3 rounded-full border border-dashed border-white/20 motion-safe:animate-orbit" style={{ animationDuration: "30s" }} />
                <ShieldCheck className="size-14" strokeWidth={1.25} aria-hidden />
                <span aria-hidden className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent motion-safe:animate-scan" />
              </div>
              <p className="mt-8 text-center text-sm text-neutral-400">Cross-tenant access attempts are part of the automated test suite.</p>
            </div>
          </li>
          {SECURITY.map(({ icon: Icon, title, body, span }, i) => (
            <li key={title} className={cn("reveal", span)} style={delay((i % 3) * 90)}>
              <article
                data-spotlight
                className="h-full rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-500 [--spot:255_255_255] hover:border-white/25"
              >
                <Icon className="size-5" aria-hidden />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{body}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: UserRoundPlus, title: "Create your account", body: "Sign up and confirm your email address." },
  { icon: Building2, title: "Set up your organization", body: "Pick a name and URL. You become its owner." },
  { icon: Users, title: "Invite your team", body: "Send invitations with the right role for each person." },
  { icon: CreditCard, title: "Choose a plan", body: "Monthly or yearly — switch whenever you need." },
];

export function StepsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <SectionHeading eyebrow="Get started" title="Up and running in minutes" body="No sales call, no setup project. These steps work today." />
      <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="reveal" style={delay(i * 100)}>
            <article data-spotlight className="group h-full rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-5xl font-semibold tracking-tighter text-neutral-200 transition-colors duration-500 group-hover:text-black dark:text-neutral-800 dark:group-hover:text-white">
                  0{i + 1}
                </span>
                <Icon className="size-5 text-black dark:text-white" aria-hidden />
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
    a: "Each plan is offered monthly or yearly, with yearly priced at ten months. Checkout runs through Paddle. A plan becomes active only after Paddle's signed confirmation reaches our server; that activation step is still being built.",
  },
  {
    q: "Is there a dark mode?",
    a: "Yes. Aoient starts in the light theme, and you can switch to dark from the header or your account menu.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-neutral-200 dark:border-neutral-900">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-[1fr_1.5fr]">
        <div className="reveal">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">FAQ</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-black sm:text-5xl dark:text-white">Questions, answered</h2>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Straight answers about what works today and what&apos;s coming.</p>
        </div>
        <div className="grid gap-3">
          {FAQ.map(({ q, a }, i) => (
            <details
              key={q}
              className="reveal group rounded-2xl border border-neutral-200 bg-white px-5 transition-colors open:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:open:border-neutral-600"
              style={delay(i * 70)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-black dark:text-white [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="size-4 shrink-0 transition-transform duration-300 group-open:rotate-180" aria-hidden />
              </summary>
              <p className="animate-fade-up pb-5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="reveal spin-border relative overflow-hidden rounded-[32px] [--card-bg:#0a0a0a] motion-safe:animate-spin-border dark:[--card-bg:#fafafa] [--spot:255_255_255] dark:[--spot:0_0_0]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] dark:bg-[radial-gradient(rgb(0_0_0/0.12)_1px,transparent_1px)]"
        />
        <div className="relative px-6 py-20 text-center text-white sm:py-24 dark:text-black">
          <h2 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Bring your whole business into one place.</h2>
          <p className="mx-auto mt-5 max-w-xl text-white/65 dark:text-black/60">Create a workspace, invite your team and grow into each module as it ships.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 dark:bg-black dark:text-white"
            >
              Get started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              href="/sign-in"
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
          <ul className="mt-3 grid gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            {NAV.slice(0, 4).map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-black dark:hover:text-white">{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Account">
          <p className="text-sm font-semibold text-black dark:text-white">Account</p>
          <ul className="mt-3 grid gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li><Link href="/sign-up" className="transition-colors hover:text-black dark:hover:text-white">Create account</Link></li>
            <li><Link href="/sign-in" className="transition-colors hover:text-black dark:hover:text-white">Sign in</Link></li>
            <li><Link href="/forgot-password" className="transition-colors hover:text-black dark:hover:text-white">Reset password</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-900">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-neutral-500 sm:px-6">© 2026 Aoient</p>
      </div>
      <p aria-hidden className="pointer-events-none select-none overflow-hidden text-center text-[22vw] font-semibold leading-[0.8] tracking-tighter text-neutral-100 dark:text-neutral-900">
        Aoient
      </p>
    </footer>
  );
}
