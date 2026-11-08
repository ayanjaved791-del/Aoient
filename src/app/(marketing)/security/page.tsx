import type { Metadata } from "next";
import Link from "next/link";
import { InnerHero, PageIndex, SlimCta } from "@/modules/marketing/inner";

export const metadata: Metadata = {
  title: "Security",
  description: "How Aoient keeps each company's data separate: server-side tenant checks, row-level security, least-privilege roles, verified payments and an audit log.",
};

const PRINCIPLES = [
  ["Checked on the server", "The browser is never trusted to say who you are or which company you belong to."],
  ["Denied by default", "If a permission isn't explicitly granted, the answer is no."],
  ["Honest about gaps", "What isn't built yet is listed at the bottom of this page."],
];

/** Mirrors docs/SECURITY.md. Only controls that are built and covered by tests are listed here. */
const CONTROLS = [
  { id: "isolation", title: "Tenant isolation", body: "Every page, action, API call and live update proves on the server that you're an active member of the organization. Automated tests try to read and change other companies' data and must fail." },
  { id: "not-found", title: "No existence leaks", body: "Another company's records and records that don't exist return the same \"not found\" answer, so nobody can probe for them." },
  { id: "database", title: "Locked-down database", body: "Row-level security is on for every table with no browser policies, so the public key can't read or write anything directly." },
  { id: "roles", title: "Roles without escalation", body: "Permissions are checked on the server. You can't grant permissions you don't hold, act on more senior members, or change your own role. Linking an account to an employee record needs the right to see private details." },
  { id: "sign-in", title: "Verified sign-in", body: "Accounts are handled by Supabase Auth with email verification or Google. Sign-up and sign-in forms are protected by a Cloudflare Turnstile bot check, and redirects after sign-in can never leave the site." },
  { id: "staff-logins", title: "Staff logins", body: "Temporary passwords set by an admin are never stored or logged by Aoient. People choose their own at first sign-in, and signing in with Google retires the temporary one." },
  { id: "invitations", title: "Safe invitations", body: "Invitation links carry a random 256-bit token stored only as a hash, expire after 7 days, work once, and only for the invited email address." },
  { id: "payments", title: "Verified payments", body: "Plans change only when Paddle's signed webhook or Paddle's API confirms them on our server. A browser redirect never unlocks anything." },
  { id: "audit", title: "Audit log", body: "Organization, member, role, people, leave and billing changes are recorded in the same database transaction as the change itself." },
  { id: "inputs", title: "Rate limits and input checks", body: "Sensitive actions are rate-limited, every input is validated on the server, all database queries are parameterised, and CSV exports are protected against formula injection." },
  { id: "headers", title: "Secure headers, no secrets in the browser", body: "Clickjacking and sniffing protections are on, and secret keys are only ever read on the server." },
];

const NOT_YET = [
  "Two-factor authentication (MFA)",
  "Content Security Policy header",
  "Automated backups and monitoring dashboards",
  "A searchable audit log page in the app (the data is already recorded)",
];

export default function SecurityPage() {
  return (
    <>
      <InnerHero crumb="Security" title="How we keep your data yours" faces={["glasses", "bob"]}
        body="Aoient keeps every company's data separate from the first line of code. This page lists exactly what protects it today, and what isn't built yet." />

      <section className="border-b border-neutral-200 dark:border-neutral-900">
        <ul className="mx-auto grid max-w-6xl divide-y divide-neutral-200 px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-neutral-900">
          {PRINCIPLES.map(([title, body], i) => (
            <li key={title} className="py-8 md:px-8 md:first:pl-0 md:last:pr-0">
              <p className="font-mono text-xs text-neutral-400">Principle {i + 1}</p>
              <h2 className="mt-2 text-lg font-bold tracking-tight">{title}</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[220px_1fr] lg:gap-16">
        <PageIndex title="Controls" items={[...CONTROLS.map((c) => ({ id: c.id, label: c.title })), { id: "not-yet", label: "Not built yet" }]} />
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">What&apos;s in place today</h2>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">Each control below is implemented and covered by automated tests.</p>
          <ol className="mt-8">
            {CONTROLS.map((c, i) => (
              <li key={c.id} id={c.id} className="scroll-mt-24 grid grid-cols-[3rem_1fr] gap-x-2 border-t border-neutral-200 py-7 dark:border-neutral-900">
                <span className="font-mono text-sm text-neutral-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                    {c.title}
                    <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-medium dark:border-neutral-700">In place</span>
                  </h3>
                  <p className="mt-2 leading-relaxed text-neutral-600 dark:text-neutral-400">{c.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div id="not-yet" className="mt-10 scroll-mt-24 rounded-2xl bg-black p-7 text-white dark:bg-white dark:text-black">
            <h2 className="text-xl font-bold">Not built yet</h2>
            <p className="mt-1 text-sm text-white/65 dark:text-black/60">We don&apos;t claim these until they exist.</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {NOT_YET.map((t) => (
                <li key={t} className="rounded-xl border border-dashed border-white/25 px-4 py-3 text-sm dark:border-black/25">{t}</li>
              ))}
            </ul>
          </div>

          <p className="mt-8 text-sm text-neutral-600 dark:text-neutral-400">
            How we handle personal data is described in the <Link href="/privacy" className="font-medium text-black underline underline-offset-4 dark:text-white">Privacy Policy</Link>.
          </p>
        </div>
      </div>

      <SlimCta title="Bring your team in safely." />
    </>
  );
}
