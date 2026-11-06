"use client";
import Link from "next/link";
import { useState } from "react";
import { Building2, Check, Rocket, Sparkles } from "lucide-react";
import {
  PLANS,
  priceFor,
  yearlySavingPercent,
  ANNUAL_MONTHS_CHARGED,
  type BillingInterval,
} from "@/lib/billing/plans";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS = { medisea: Sparkles, indiana: Rocket, pacfic_deepdive: Building2 } as const;

export function PricingPage({ user, orgSlug }: { user: { name: string; email: string }; orgSlug?: string }) {
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const saving = yearlySavingPercent();
  const freeMonths = 12 - ANNUAL_MONTHS_CHARGED;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Aoient home" className="rounded-md"><Logo /></Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden min-w-0 truncate text-sm font-medium sm:block">{user.name}</span>
            <UserMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Choose your plan</h1>
          <p className="mt-3 text-muted-foreground">
            One platform for your people, customers, projects and time. Prices in USD; taxes are calculated at checkout.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <div role="radiogroup" aria-label="Billing period" className="relative inline-grid grid-cols-2 rounded-full border border-border bg-surface p-1">
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-navy shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-primary",
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
                  "relative z-10 rounded-full px-5 py-1.5 text-sm font-medium uppercase tracking-wide transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  interval === value ? "text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-10 grid gap-6 md:grid-cols-3 md:items-stretch">
          {PLANS.map((plan, index) => {
            const Icon = ICONS[plan.id];
            const price = priceFor(plan, interval);
            const featured = plan.featured;
            return (
              <li key={plan.id} className="animate-rise-in flex flex-col" style={{ animationDelay: `${120 + index * 120}ms` }}>
                <p key={interval} className="animate-fade-up mb-3 h-10 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {interval === "yearly" ? (
                    <>Save {saving}%<br />{freeMonths} months free</>
                  ) : (
                    <>Billed monthly<br />Cancel anytime</>
                  )}
                </p>
                <article
                  aria-labelledby={`plan-${plan.id}`}
                  className={cn(
                    "group relative isolate flex flex-1 flex-col overflow-hidden rounded-xl border p-6 shadow-xs transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-2 focus-within:-translate-y-2",
                    featured
                      ? "border-navy bg-navy text-white hover:shadow-[0_24px_48px_-12px_rgba(99,91,255,0.45)] md:scale-[1.03] md:hover:scale-[1.05] dark:border-primary dark:bg-primary-subtle"
                      : "border-border bg-surface hover:border-primary/50 hover:shadow-[0_20px_40px_-16px_rgba(16,24,40,0.25)]",
                  )}
                >
                  {featured && (
                    <span
                      aria-hidden
                      className="animate-glow-pulse pointer-events-none absolute -z-10 -left-16 -top-16 size-48 rounded-full bg-primary/40 blur-3xl"
                    />
                  )}
                  <div
                    className={cn(
                      "absolute right-0 top-0 rounded-bl-xl px-4 py-2 text-right",
                      featured ? "bg-white text-navy dark:bg-primary dark:text-white" : "bg-navy text-white dark:bg-primary",
                    )}
                  >
                    <span key={interval} className="animate-price-pop block">
                      <span className="text-2xl font-semibold tabular-nums">${price.amount.toLocaleString("en-US")}</span>
                      <span className="block text-[11px] font-medium opacity-80">per {price.per}</span>
                    </span>
                  </div>

                  <span
                    className={cn(
                      "relative flex size-11 items-center justify-center rounded-lg border transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110",
                      featured ? "border-white/20 bg-white/10" : "border-border bg-background text-primary",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h2 id={`plan-${plan.id}`} className="mt-4 text-xl font-semibold">
                    {plan.name}
                    {featured && (
                      <span className="ml-2 align-middle rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">Most popular</span>
                    )}
                  </h2>
                  <p className={cn("mt-1 text-sm", featured ? "text-white/75" : "text-muted-foreground")}>{plan.tagline}</p>
                  {interval === "yearly" && (
                    <p className={cn("animate-fade-up mt-1 text-xs", featured ? "text-white/75" : "text-muted-foreground")}>
                      ${(price.amount / 12).toFixed(2)}/month, billed yearly
                    </p>
                  )}

                  <ul className="mt-6 grid flex-1 content-start gap-3 text-sm">
                    {plan.features.map((f, i) => (
                      <li key={f} className="animate-fade-up flex gap-2.5" style={{ animationDelay: `${360 + index * 120 + i * 45}ms` }}>
                        <Check className={cn("mt-0.5 size-4 shrink-0", featured ? "text-white" : "text-success")} aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    className={cn("relative mt-8 w-full transition-transform active:scale-[0.98]", featured && "bg-white text-navy hover:bg-white/90 dark:bg-primary dark:text-white dark:hover:bg-primary-hover")}
                  >
                    <Link href={`/checkout/${plan.id}?interval=${interval}${orgSlug ? `&org=${orgSlug}` : ""}`} aria-label={`Buy ${plan.name}, ${interval}`}>
                      Buy now
                    </Link>
                  </Button>
                </article>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Need more than 40 users or custom security? Enterprise plans are tailored to your team, with pricing on request.
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
          Signed in as {user.email}. Prices and limits are provisional and may change before launch.
        </p>
      </main>
    </div>
  );
}
