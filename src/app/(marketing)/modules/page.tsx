import type { Metadata } from "next";
import { InnerHero, PrimaryLink, SecondaryLink, SlimCta, Status } from "@/modules/marketing/inner";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Modules",
  description: "Every Aoient module in one catalogue: what's live today, what's inside each one, and how they share the same people, customers and projects.",
};

type Mod = { name: string; live: boolean; summary: string; inside: string[]; uses: string };

/** The catalogue. "live" only for modules that work in the product today. */
const MODULES: Mod[] = [
  { name: "Organization & access", live: true, summary: "The base every workspace starts with.", inside: ["Workspaces and members", "Invitations and staff logins", "Built-in and custom roles", "Audit log"], uses: "Everything" },
  { name: "People", live: true, summary: "Your team, their details and their time off.", inside: ["Employee directory", "Departments and managers", "Private HR details", "Leave with approvals"], uses: "Members, Dashboards" },
  { name: "Dashboards", live: true, summary: "A live overview for each role.", inside: ["Owner and admin overview", "Personal view for employees", "Activity and trends", "CSV export"], uses: "All live modules" },
  { name: "CRM", live: true, summary: "Customers and the deals you're working on.", inside: ["Leads and contacts", "Companies", "Deal pipeline", "Sales reports"], uses: "Projects, Finance" },
  { name: "Projects", live: true, summary: "Delivery, from a won deal to done.", inside: ["Projects and tasks", "Boards", "Milestones"], uses: "CRM, People, Time" },
  { name: "Time", live: false, summary: "Hours worked, and which are billable.", inside: ["Timers", "Timesheets and approvals", "Billable hours"], uses: "Projects, Finance" },
  { name: "Finance", live: true, summary: "Getting paid for the work you delivered.", inside: ["Invoices and estimates", "Payments received", "Expenses with approvals", "Vendors and reports"], uses: "CRM, Projects" },
  { name: "Documents", live: false, summary: "Files attached to the work they belong to.", inside: ["Proposals", "Contracts", "Shared files"], uses: "CRM, Projects" },
  { name: "Flow", live: false, summary: "Automations that move work along for you.", inside: ["Triggers and actions", "Between modules"], uses: "All modules" },
  { name: "Connect", live: false, summary: "Links to the tools you already use.", inside: ["Email and calendar", "Payments and accounting"], uses: "All modules" },
];

const FLOW = ["Win a deal", "Start the project", "Staff it", "Track time", "Send the invoice", "See the numbers"];

export default function ModulesPage() {
  const live = MODULES.filter((m) => m.live).length;
  return (
    <>
      <InnerHero crumb="Modules" title="The module catalogue" faces={["cap", "spiky"]}
        body={`Aoient is built as modules that share one set of people, customers and projects. ${live} are live today; the others are released one at a time.`}>
        <PrimaryLink href="/sign-up">Start with what&apos;s live</PrimaryLink>
        <SecondaryLink href="/features">What works today</SecondaryLink>
      </InnerHero>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">All modules</h2>
          <p className="text-sm text-neutral-500">{live} live · {MODULES.length - live} in development</p>
        </div>

        {/* Table on wide screens, cards on phones. */}
        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-neutral-200 md:block dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Aoient modules</caption>
            <thead className="bg-[#f7f7f5] text-xs uppercase tracking-wider text-neutral-500 dark:bg-neutral-950">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Module</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">What&apos;s inside</th>
                <th scope="col" className="px-5 py-3 font-medium">Works with</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.name} className={cn("border-t border-neutral-200 align-top dark:border-neutral-800", !m.live && "text-neutral-600 dark:text-neutral-400")}>
                  <th scope="row" className="px-5 py-4">
                    <span className={cn("block font-semibold", m.live ? "text-black dark:text-white" : "")}>{m.name}</span>
                    <span className="mt-0.5 block font-normal text-neutral-500">{m.summary}</span>
                  </th>
                  <td className="px-5 py-4"><Status live={m.live} /></td>
                  <td className="px-5 py-4">{m.inside.join(" · ")}</td>
                  <td className="px-5 py-4 text-neutral-500">{m.uses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-6 grid gap-3 md:hidden">
          {MODULES.map((m) => (
            <li key={m.name} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{m.name}</h3>
                <Status live={m.live} />
              </div>
              <p className="mt-1 text-sm text-neutral-500">{m.summary}</p>
              <p className="mt-3 text-sm">{m.inside.join(" · ")}</p>
              <p className="mt-2 text-xs text-neutral-500">Works with: {m.uses}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-black text-white dark:bg-white dark:text-black">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">How the modules pass work along</h2>
          <p className="mt-3 max-w-2xl text-white/65 dark:text-black/60">The same record moves from one module to the next, so nothing is typed twice. CRM, Projects and Finance already connect: a won deal becomes a project, and invoices link to the client and the project. Time, still in development, completes the flow.</p>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 sm:grid-cols-2 lg:grid-cols-6 dark:border-black/15 dark:bg-black/15">
            {FLOW.map((step, i) => (
              <li key={step} data-reveal="blur" className="reveal relative bg-black p-5 dark:bg-white" style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}>
                <span className="font-mono text-xs text-white/50 dark:text-black/50">Step {i + 1}</span>
                <p className="mt-2 font-semibold">{step}</p>
                {i < FLOW.length - 1 && <span aria-hidden className="absolute right-3 top-4 hidden text-white/40 lg:block dark:text-black/40">→</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <SlimCta title="Start with People today." body="Every new module turns on in the same workspace when it's released." />
    </>
  );
}
