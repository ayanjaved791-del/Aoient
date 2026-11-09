import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Assistant, AuditFeed, Directory, Install, Isolation, LiveSync, Logins, Permissions, RoleViews } from "@/modules/marketing/bento";
import { InnerHero, PageIndex, PrimaryLink, SecondaryLink, SlimCta, Status } from "@/modules/marketing/inner";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Features",
  description: "Everything Aoient does today, in detail: People and leave, role-based dashboards, permissions, staff logins, live updates, the assistant, the app and the audit log.",
};

type Feature = { id: string; title: string; lead: string; points: string[]; visual: ReactNode; dark?: boolean };

/** Only features that work today. Each "point" is something you can actually do. */
const FEATURES: Feature[] = [
  {
    id: "people", title: "People directory", lead: "Everyone in your company in one list, with the details each person is allowed to see.",
    points: ["Departments, job titles, managers and start dates", "Private details (salary, birthday, contacts) only for HR and the person themselves", "Search, and filter by department or status", "Archive people who leave without losing history"],
    visual: <Directory />,
  },
  {
    id: "leave", title: "Leave and approvals", lead: "Request time off in a few clicks and see who's out today.",
    points: ["Annual, sick, unpaid and other leave, with half days", "Weekends are never counted as leave days", "Managers approve or decline with a note", "Nobody can approve their own leave"],
    visual: <LeaveCard />,
  },
  {
    id: "dashboards", title: "A dashboard for every role", lead: "One workspace, but each person sees the view that fits their job.",
    points: ["Owners and admins see team, activity, plan and people", "Employees see their own profile and leave", "Custom roles see exactly the parts you switch on", "Every number comes from real records"],
    visual: <RoleViews />, dark: true,
  },
  {
    id: "roles", title: "Roles and permissions", lead: "Built-in roles for common jobs, plus your own custom roles.",
    points: ["Owner, Admin, HR, Sales, Project, Finance, Employee and Client roles", "Custom roles from a list of permissions", "Nobody can hand out more access than they have", "Owners can't be changed by admins"],
    visual: <Permissions />,
  },
  {
    id: "logins", title: "Logins for your staff", lead: "Bring people in with an invite link, or give them a login yourself.",
    points: ["Invite links are single-use and expire after 7 days", "Or set an email and temporary password for them", "They choose their own password at first sign-in", "Sign in with email or Google; sign-up forms have a bot check"],
    visual: <Logins />,
  },
  {
    id: "live", title: "Live without refreshing", lead: "When something changes, every open screen catches up by itself.",
    points: ["Updates within seconds of a change", "Never interrupts someone who is typing", "Picks up new versions of Aoient automatically", "Only reacts to changes in your own workspace"],
    visual: <LiveSync />,
  },
  {
    id: "assistant", title: "Ask Aoient", lead: "Ask plain questions about your workspace and get answers from your records.",
    points: ["\"Who is on leave today?\", \"How many members do we have?\"", "Understands English and Roman Urdu", "Answers only with what your role may see", "Runs on our own rules, no outside AI service"],
    visual: <Assistant />,
  },
  {
    id: "security", title: "Your data stays yours", lead: "Each company's records are walled off from every other company.",
    points: ["Membership is checked on the server for every request", "Other companies' records answer \"not found\"", "Automated tests try to break in on every change", "Paid plans switch on only from Paddle's signed confirmation"],
    visual: <Isolation />, dark: true,
  },
  {
    id: "app", title: "Install it like an app", lead: "Add Aoient to your computer or phone straight from the browser.",
    points: ["Opens in its own window", "Works on Windows, Mac, Android and iPhone", "Shows a friendly page when you're offline", "Updates itself"],
    visual: <Install />,
  },
  {
    id: "audit", title: "Every change on record", lead: "A history of who did what, and when.",
    points: ["Member, role, settings, people and leave changes", "Shown as plain sentences on the dashboard", "Never stores passwords or private values", "Export dashboard numbers as CSV"],
    visual: <AuditFeed />,
  },
];

const COMING = [
  ["Time", "Timers, timesheets and billable hours."],
  ["Documents", "Proposals, contracts and files."],
  ["Flow", "Automations between modules."],
  ["Connect", "Integrations with the tools you already use."],
];

function LeaveCard() {
  return (
    <div className="w-full rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-black">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Annual leave</span>
        <span className="rounded-full bg-black px-2 py-0.5 text-[11px] font-medium text-white dark:bg-white dark:text-black">Approved</span>
      </div>
      <p className="mt-1 text-neutral-500">Mon 16 – Fri 20 Nov · 5 working days</p>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className={cn("rounded-md py-1.5", i < 5 ? "bg-black text-white dark:bg-white dark:text-black" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-900")}>{d}</span>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-500">Weekends not counted · approved by Laila Shah</p>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <InnerHero crumb="Features" title="Everything Aoient does today, in detail" faces={["glasses", "curly", "bun"]}
        body="No roadmap dressed up as features. Every section on this page works right now, and the list at the end says what's still being built.">
        <PrimaryLink href="/sign-up">Start your free trial</PrimaryLink>
        <SecondaryLink href="/modules">See the modules</SecondaryLink>
      </InnerHero>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[200px_1fr] lg:gap-16">
        <PageIndex items={[...FEATURES.map((f) => ({ id: f.id, label: f.title })), { id: "coming", label: "Still being built" }]} />
        <div>
          {FEATURES.map((f, i) => (
            <section key={f.id} id={f.id} className="scroll-mt-24 border-b border-neutral-200 py-12 first:pt-0 dark:border-neutral-900">
              <div className="grid gap-8 md:grid-cols-2 md:items-center">
                <div data-reveal="left" className="reveal">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-neutral-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <Status live />
                  </div>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{f.title}</h2>
                  <p className="mt-2 text-neutral-600 dark:text-neutral-400">{f.lead}</p>
                  <ul className="mt-5 grid gap-2.5 text-sm">
                    {f.points.map((p) => (
                      <li key={p} className="flex gap-3">
                        <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-black dark:bg-white" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div
                  aria-hidden
                  data-reveal="scale"
                  className={cn("reveal flex min-h-56 items-center rounded-2xl p-6", f.dark ? "bg-black text-white dark:bg-white dark:text-black" : "bg-[#f7f7f5] dark:bg-neutral-950", i % 2 ? "md:order-first" : "")}
                >
                  {f.visual}
                </div>
              </div>
            </section>
          ))}

          <section id="coming" className="scroll-mt-24 pt-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Still being built</h2>
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">These are on the way. We&apos;ll move them up this page when they work, not before.</p>
            <dl className="mt-6 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-900 dark:border-neutral-800">
              {COMING.map(([name, body]) => (
                <div key={name} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
                  <dt className="w-32 shrink-0 font-semibold">{name}</dt>
                  <dd className="flex-1 text-sm text-neutral-600 dark:text-neutral-400">{body}</dd>
                  <dd><Status live={false} /></dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <SlimCta />
    </>
  );
}
