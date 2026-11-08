"use client";
import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import {
  PLANS,
  priceFor,
  yearlySavingPercent,
  ANNUAL_MONTHS_CHARGED,
  type BillingInterval,
} from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Plan picker. Public: visitors see the same plans; "Buy now" sends them to
 * create an account first and then straight on to checkout.
 */
export function PricingPage({ user, orgSlug }: { user: { name: string; email: string } | null; orgSlug?: string }) {
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const saving = yearlySavingPercent();
  const freeMonths = 12 - ANNUAL_MONTHS_CHARGED;

  return (
    <div>
      <section className="border-b border-neutral-200 dark:border-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-12 pt-14 sm:px-6 sm:pt-20 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <nav aria-label="Breadcrumb" className="animate-fade-up text-sm text-neutral-500">
              <Link href="/" className="hover:text-black dark:hover:text-white">Aoient</Link>
              <span className="mx-2">/</span>
              <span className="text-black dark:text-white">Pricing</span>
            </nav>
            <h1 className="animate-fade-up mt-5 max-w-2xl text-balance text-4xl font-bold tracking-tighter sm:text-6xl" style={{ animationDelay: "60ms" }}>Pick a plan. Change it any time.</h1>
            <p className="animate-fade-up mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-400" style={{ animationDelay: "120ms" }}>
              Prices in USD. Taxes are worked out at checkout by Paddle.
            </p>
          </div>
          <div className="animate-fade-up shrink-0" style={{ animationDelay: "180ms" }}>
            <div role="radiogroup" aria-label="Billing period" className="relative inline-grid grid-cols-2 rounded-lg border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-black">
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-black transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-white",
                  interval === "yearly" && "translate-x-full",
                )}
              />
              {(["monthly", "yearly"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={interval === value}
                  onClick={() => setBillingInterval(value)}
                  className={cn(
                    "relative z-10 rounded-md px-6 py-2 text-sm font-semibold capitalize transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    interval === value ? "text-white dark:text-black" : "text-neutral-500 hover:text-black dark:hover:text-white",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-neutral-500">Yearly: save {saving}%, {freeMonths} months free.</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <ul className="grid gap-4 md:grid-cols-3 md:items-stretch">
          {PLANS.map((plan, index) => {
            const price = priceFor(plan, interval);
            const featured = plan.featured;
            return (
              <li key={plan.id} className="animate-rise-in flex flex-col" style={{ animationDelay: `${120 + index * 100}ms` }}>
                <article
                  aria-labelledby={`plan-${plan.id}`}
                  className={cn(
                    "flex flex-1 flex-col rounded-2xl border p-7 transition-transform duration-300 hover:-translate-y-1",
                    featured ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 id={`plan-${plan.id}`} className="text-xl font-bold">{plan.name}</h2>
                    {featured && <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-black dark:bg-black dark:text-white">Most popular</span>}
                  </div>
                  <p className={cn("mt-1 text-sm", featured ? "text-white/70 dark:text-black/60" : "text-neutral-500")}>{plan.tagline}</p>
                  <p key={interval} className="animate-price-pop mt-7 flex items-baseline gap-1.5">
                    <span className="text-5xl font-bold tracking-tight tabular-nums">${price.amount.toLocaleString("en-US")}</span>
                    <span className={cn("text-sm", featured ? "text-white/70 dark:text-black/60" : "text-neutral-500")}>/ {price.per}</span>
                  </p>
                  <p className={cn("mt-1 h-4 text-xs", featured ? "text-white/70 dark:text-black/60" : "text-neutral-500")}>
                    {interval === "yearly" ? `$${(price.amount / 12).toFixed(2)} a month, billed yearly` : "Billed monthly, cancel any time"}
                  </p>
                  <Button
                    asChild
                    className={cn(
                      "mt-6 w-full rounded-lg transition-transform active:scale-[0.98]",
                      featured
                        ? "bg-white text-black hover:bg-neutral-200 dark:bg-black dark:text-white dark:hover:bg-neutral-800"
                        : "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200",
                    )}
                  >
                    <Link href={buyHref(plan.id, interval, orgSlug, Boolean(user))} aria-label={`Buy ${plan.name}, ${interval}`}>
                      Buy now
                    </Link>
                  </Button>
                  <ul className={cn("mt-7 grid flex-1 content-start gap-3 border-t pt-6 text-sm", featured ? "border-white/15 dark:border-black/15" : "border-neutral-200 dark:border-neutral-800")}>
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-sm text-neutral-500">
          {user ? `Signed in as ${user.email}. ` : "Every new workspace starts with a 14-day free trial, no card needed. "}
          Need more than 40 users? Enterprise plans are tailored to your team. Prices and limits are provisional and may change before launch.
        </p>
      </main>
    </div>
  );
}

function buyHref(planId: string, interval: BillingInterval, orgSlug: string | undefined, signedIn: boolean) {
  const checkout = `/checkout/${planId}?interval=${interval}${orgSlug ? `&org=${orgSlug}` : ""}`;
  return signedIn ? checkout : `/sign-up?next=${encodeURIComponent(checkout)}`;
}
