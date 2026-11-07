import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Check, Minus } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { PricingPage } from "@/modules/billing/pricing-page";
import { CtaSection, SectionHeading } from "@/modules/marketing/sections";
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
  { label: "Active projects", values: (id) => (ENTITLEMENTS[id].maxActiveProjects === null ? "Unlimited" : String(ENTITLEMENTS[id].maxActiveProjects)), note: "when Projects ships" },
  { label: "Automations", values: (id) => String(ENTITLEMENTS[id].maxAutomations), note: "when Flow ships" },
  { label: "Audit log, invitations, roles", values: () => true },
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

      <section className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-950/40">
        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="Compare" title="Every plan, side by side" body={`Limits are checked on the server. Every workspace starts with a ${TRIAL_DAYS}-day free trial on Medisea limits.`} />
          <div data-reveal="scale" className="reveal mt-12 overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Plan comparison</caption>
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th scope="col" className="px-5 py-4 font-medium text-neutral-500">Plan</th>
                  {PLANS.map((p) => (
                    <th key={p.id} scope="col" className="px-5 py-4 text-base font-semibold">
                      {p.name}
                      {p.featured && <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 align-middle text-[10px] font-medium text-white">Popular</span>}
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
                        <td key={p.id} className="px-5 py-3.5 font-medium tabular-nums">
                          {v === true ? (
                            <Check className="size-4 text-emerald-500" aria-label="Included" />
                          ) : v === false ? (
                            <Minus className="size-4 text-neutral-300 dark:text-neutral-700" aria-label="Not included" />
                          ) : (
                            v
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
            Questions about billing, trials or cancelling? <Link href="/faq" className="font-medium text-black underline-offset-4 hover:underline dark:text-white">Read the FAQ</Link>.
          </p>
        </div>
      </section>
      <CtaSection />
    </>
  );
}
