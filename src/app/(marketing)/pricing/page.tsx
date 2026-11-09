import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { PricingPage } from "@/modules/billing/pricing-page";
import { SlimCta } from "@/modules/marketing/inner";
import { Skeleton } from "@/components/ui/skeleton";
import { PLANS, priceFor } from "@/lib/billing/plans";
import { ENTITLEMENTS, TRIAL_DAYS } from "@/lib/billing/entitlements";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Medisea, Indiana and Pacfic-DeepDive plans, monthly or yearly with two months free. Every workspace starts with a 14-day free trial.",
};

async function Plans({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const slug = org && /^[a-z0-9-]{1,64}$/.test(org) ? org : undefined;
  await connection();
  const user = await getSessionUser().catch(() => null);
  return <PricingPage user={user ? { name: user.name, email: user.email } : null} orgSlug={slug} />;
}

type Cell = string | boolean;
const ROWS: { label: string; values: (planId: (typeof PLANS)[number]["id"]) => Cell; note?: string }[] = [
  { label: "Monthly price", values: (id) => `$${priceFor(PLANS.find((p) => p.id === id)!, "monthly").amount}` },
  { label: "Yearly price (2 months free)", values: (id) => `$${priceFor(PLANS.find((p) => p.id === id)!, "yearly").amount}` },
  { label: "Users (members + pending invites)", values: (id) => String(ENTITLEMENTS[id].maxMembers) },
  { label: "Admin seats (Owner / Admin)", values: (id) => String(ENTITLEMENTS[id].maxAdminSeats) },
  { label: "Custom roles", values: (id) => ENTITLEMENTS[id].customRoles },
  { label: "Active projects", values: (id) => (ENTITLEMENTS[id].maxActiveProjects === null ? "Unlimited" : String(ENTITLEMENTS[id].maxActiveProjects)) },
  { label: "Automations", values: (id) => String(ENTITLEMENTS[id].maxAutomations), note: "when Flow ships" },
  { label: "Audit log, invitations, roles", values: () => true },
];

const FACTS: [string, string][] = [
  [`${TRIAL_DAYS} days`, "Free trial for every new workspace"],
  ["2 months", "Free when you pay yearly"],
  ["Any time", "Cancel from the billing portal"],
  ["Paddle", "Handles checkout, tax and receipts"],
];

export default function Pricing(props: { searchParams: Promise<{ org?: string }> }) {
  return (
    <>
      <Suspense
        fallback={
          <div className="mx-auto grid max-w-5xl gap-4 px-4 py-16" aria-busy="true">
            <Skeleton className="mx-auto h-12 w-80" />
            <div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-96" />)}</div>
          </div>
        }
      >
        <Plans {...props} />
      </Suspense>

      <section className="border-y border-neutral-200 bg-[#f7f7f5] dark:border-neutral-900 dark:bg-neutral-950">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4">
          {FACTS.map(([big, label]) => (
            <li key={label} className="py-10 pr-6">
              <p className="text-4xl font-bold tracking-tight">{big}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Every plan, side by side</h2>
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">Limits are checked on the server. The free trial uses Medisea&apos;s limits.</p>
          </div>
          <Link href="/faq#billing" className="text-sm font-semibold underline-offset-4 hover:underline">Billing questions →</Link>
        </div>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[600px] text-left text-sm">
            <caption className="sr-only">Plan comparison</caption>
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th scope="col" className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-neutral-500">Plan</th>
                {PLANS.map((p) => (
                  <th key={p.id} scope="col" className={p.featured ? "bg-black px-5 py-4 text-base font-bold text-white dark:bg-white dark:text-black" : "px-5 py-4 text-base font-bold"}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                  <th scope="row" className="px-5 py-3.5 font-normal text-neutral-600 dark:text-neutral-400">
                    {row.label}
                    {row.note && <span className="block text-xs text-neutral-400">{row.note}</span>}
                  </th>
                  {PLANS.map((p) => {
                    const v = row.values(p.id);
                    return (
                      <td key={p.id} className={p.featured ? "bg-neutral-50 px-5 py-3.5 font-semibold tabular-nums dark:bg-neutral-950" : "px-5 py-3.5 font-medium tabular-nums"}>
                        {v === true ? <span aria-label="Included">Yes</span> : v === false ? <span aria-label="Not included" className="text-neutral-400">—</span> : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <SlimCta title="Not sure yet? Start free." body={`${TRIAL_DAYS} days with Medisea limits. Pick a plan whenever you are ready.`} />
    </>
  );
}
