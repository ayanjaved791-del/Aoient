"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { ANNUAL_MONTHS_CHARGED, PLANS, priceFor, type BillingInterval } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export function PricingTeaser() {
  const [interval, setInterval_] = useState<BillingInterval>("monthly");
  return (
    <div>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Billing period" className="relative inline-grid grid-cols-2 rounded-full border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950">
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-md shadow-fuchsia-500/30 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              interval === "yearly" && "translate-x-full",
            )}
          />
          {(["monthly", "yearly"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => setInterval_(value)}
              className={cn(
                "relative z-10 rounded-full px-5 py-1.5 text-sm font-medium capitalize transition-colors duration-300",
                interval === value ? "text-white" : "text-neutral-500 hover:text-black dark:hover:text-white",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-neutral-500">
        Yearly: pay for {ANNUAL_MONTHS_CHARGED} months, get 12.
      </p>

      <ul className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan, i) => {
          const price = priceFor(plan, interval);
          const featured = plan.featured;
          return (
            <li key={plan.id} className="reveal" style={{ "--reveal-delay": `${i * 120}ms` } as React.CSSProperties}>
              <article
                data-spotlight
                className={cn(
                  "flex h-full flex-col rounded-2xl border p-7 transition-transform duration-500 hover:-translate-y-1.5",
                  featured
                    ? "spin-border border-transparent bg-black text-white [--card-bg:#0a0a0a] [--spot:255_255_255] motion-safe:animate-spin-border dark:[--card-bg:#fafafa] dark:[--spot:0_0_0] dark:text-black"
                    : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {featured && (
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-black dark:bg-black dark:text-white">Most popular</span>
                  )}
                </div>
                <p className={cn("mt-1 text-sm", featured ? "text-white/65 dark:text-black/60" : "text-neutral-500")}>{plan.tagline}</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span key={`${plan.id}-${interval}`} className="animate-price-pop text-4xl font-semibold tracking-tight tabular-nums">
                    ${price.amount.toLocaleString("en-US")}
                  </span>
                  <span className={cn("text-sm", featured ? "text-white/65 dark:text-black/60" : "text-neutral-500")}>/ {price.per}</span>
                </p>
                <ul className="mt-6 grid flex-1 content-start gap-2.5 text-sm">
                  {plan.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span className={featured ? "text-white/85 dark:text-black/80" : "text-neutral-600 dark:text-neutral-400"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={cn(
                    "group mt-8 inline-flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors",
                    featured
                      ? "bg-white text-black hover:bg-neutral-200 dark:bg-black dark:text-white dark:hover:bg-neutral-800"
                      : "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200",
                  )}
                >
                  Start with {plan.name}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </article>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-center text-xs text-neutral-500">
        Prices in USD and provisional. You choose a plan after creating your account; checkout runs through Paddle.
      </p>
    </div>
  );
}
