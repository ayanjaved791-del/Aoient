import type { Metadata } from "next";
import { CircleCheck, CircleDashed } from "lucide-react";
import type { CSSProperties } from "react";
import { CtaSection, PageHero, SectionHeading, SecuritySection } from "@/modules/marketing/sections";

export const metadata: Metadata = {
  title: "Security",
  description: "How Aoient keeps each company's data separate: server-side tenant checks, row-level security, least-privilege roles, verified payments and an audit log.",
};

/** Mirrors docs/SECURITY.md. Only controls that are built and covered by tests are listed as in place. */
const IN_PLACE = [
  { title: "Tenant isolation", body: "Every page and API call proves on the server that you're an active member of the organization. Tests try to read and change other companies' data and must fail." },
  { title: "No existence leaks", body: "Another company's records and records that don't exist return the same \"not found\" answer, so nobody can probe for them." },
  { title: "Locked-down database", body: "Row-level security is on for every table with no browser policies: the public key can't read or write anything directly." },
  { title: "Roles without escalation", body: "Permissions are checked on the server and denied by default. You can't grant permissions you don't hold, act on more senior members, or change your own role." },
  { title: "Verified sign-in", body: "Accounts are handled by Supabase Auth with email verification. Password resets sign out every session." },
  { title: "Safe invitations", body: "Invitation links carry a random 256-bit token stored only as a hash, expire after 7 days, work once, and only for the invited email address." },
  { title: "Verified payments", body: "Plans change only when Paddle's signed webhook reaches our server, each event once and in order. A browser redirect never unlocks anything." },
  { title: "Audit log", body: "Organization, member, role, invitation and billing changes are recorded in the same database transaction as the change." },
  { title: "Rate limits and input checks", body: "Invitations, joins and organization creation are rate-limited, every input is validated on the server, and all database queries are parameterised." },
  { title: "Secure headers, no secrets in the browser", body: "Clickjacking and sniffing protections are on, and secret keys are only ever read on the server." },
];

const NOT_YET = [
  "Two-factor authentication (MFA)",
  "Content Security Policy header",
  "Automated backups and monitoring dashboards (launch tasks)",
  "Audit log viewer in the app (the data is already recorded)",
];

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Your data stays yours"
        body="Aoient is multi-tenant from the first line of code. Here's exactly what protects your company's data today, and what isn't built yet."
      />
      <SecuritySection title="Protection in every layer" />

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <SectionHeading eyebrow="In detail" title="What's in place today" body="Each of these is implemented and covered by automated tests." />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2">
          {IN_PLACE.map((item, i) => (
            <li
              key={item.title}
              data-reveal={i % 2 ? "left" : "right"}
              className="reveal flex gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
              style={delay((i % 2) * 90)}
            >
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div data-reveal="scale" className="reveal mx-auto mt-12 max-w-2xl rounded-2xl border border-dashed border-neutral-300 p-6 dark:border-neutral-700">
          <h3 className="font-semibold">Not built yet</h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">We don&apos;t claim these until they exist:</p>
          <ul className="mt-4 grid gap-2 text-sm">
            {NOT_YET.map((t) => (
              <li key={t} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                <CircleDashed className="size-4 shrink-0 text-neutral-400" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <CtaSection />
    </>
  );
}
