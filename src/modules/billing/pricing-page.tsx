"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useTheme } from "next-themes";
import { initializePaddle, type Paddle, type PaddleEventData } from "@paddle/paddle-js";
import { Building2, Check, LogOut, Rocket, Sparkles } from "lucide-react";
import {
  PADDLE_CLIENT_TOKEN,
  PADDLE_ENVIRONMENT,
  PLANS,
  missingCheckoutConfig,
  paddlePriceId,
  priceFor,
  yearlySavingPercent,
  ANNUAL_MONTHS_CHARGED,
  type BillingInterval,
  type Plan,
} from "@/lib/billing/plans";
import { useLocalUser } from "@/modules/auth/use-local-user";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ICONS = { starter: Sparkles, growth: Rocket, business: Building2 } as const;

type Notice =
  | { kind: "not-configured"; plan: Plan; missing: string[] }
  | { kind: "submitted"; plan: Plan }
  | { kind: "error"; message: string };

export function PricingPage() {
  const { user, signOut } = useLocalUser();
  const { resolvedTheme } = useTheme();
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const paddleRef = useRef<Paddle | null>(null);
  const checkoutPlanRef = useRef<Plan | null>(null);
  const saving = yearlySavingPercent();
  const freeMonths = 12 - ANNUAL_MONTHS_CHARGED;

  function onPaddleEvent(event: PaddleEventData) {
    // Paddle confirming the checkout in the browser is NOT proof of payment for
    // granting access — only a verified server-side webhook may do that.
    if (event.name === "checkout.completed" && checkoutPlanRef.current) {
      paddleRef.current?.Checkout.close();
      setNotice({ kind: "submitted", plan: checkoutPlanRef.current });
    }
  }

  async function buy(plan: Plan) {
    const missing = missingCheckoutConfig(plan.id, interval);
    const priceId = paddlePriceId(plan.id, interval);
    if (missing.length > 0 || !priceId || !PADDLE_CLIENT_TOKEN) {
      setNotice({ kind: "not-configured", plan, missing });
      return;
    }
    setBusyPlan(plan.id);
    try {
      paddleRef.current ??=
        (await initializePaddle({ environment: PADDLE_ENVIRONMENT, token: PADDLE_CLIENT_TOKEN, eventCallback: onPaddleEvent })) ?? null;
      if (!paddleRef.current) throw new Error("Paddle could not be loaded.");
      checkoutPlanRef.current = plan;
      paddleRef.current.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: user ? { email: user.email } : undefined,
        customData: { aoientPlan: plan.id, interval },
        settings: { displayMode: "overlay", theme: resolvedTheme === "dark" ? "dark" : "light" },
      });
    } catch {
      setNotice({ kind: "error", message: "The checkout couldn't be opened. Check your connection and try again." });
    } finally {
      setBusyPlan(null);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-16" aria-busy="true">
        <Skeleton className="mx-auto h-9 w-72" />
        <div className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Aoient home" className="rounded-md"><Logo /></Link>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={user.name} />
            <span className="hidden min-w-0 truncate text-sm font-medium sm:block">{user.name}</span>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut aria-hidden /> Sign out
            </Button>
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
          <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border border-border bg-surface p-1">
            {(["monthly", "yearly"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={interval === value}
                onClick={() => setBillingInterval(value)}
                className={cn(
                  "rounded-full px-5 py-1.5 text-sm font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  interval === value ? "bg-navy text-white dark:bg-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-10 grid gap-6 md:grid-cols-3 md:items-stretch">
          {PLANS.map((plan) => {
            const Icon = ICONS[plan.id];
            const price = priceFor(plan, interval);
            const featured = plan.featured;
            return (
              <li key={plan.id} className="flex flex-col">
                <p className="mb-3 h-10 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {interval === "yearly" ? (
                    <>Save {saving}%<br />{freeMonths} months free</>
                  ) : (
                    <>Billed monthly<br />Cancel anytime</>
                  )}
                </p>
                <article
                  aria-labelledby={`plan-${plan.id}`}
                  className={cn(
                    "relative flex flex-1 flex-col overflow-hidden rounded-xl border p-6 shadow-xs",
                    featured
                      ? "border-navy bg-navy text-white dark:border-primary dark:bg-primary-subtle"
                      : "border-border bg-surface",
                  )}
                >
                  <div
                    className={cn(
                      "absolute right-0 top-0 rounded-bl-xl px-4 py-2 text-right",
                      featured ? "bg-white text-navy dark:bg-primary dark:text-white" : "bg-navy text-white dark:bg-primary",
                    )}
                  >
                    <span className="text-2xl font-semibold">${price.amount.toLocaleString("en-US")}</span>
                    <span className="block text-[11px] font-medium opacity-80">per {price.per}</span>
                  </div>

                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-lg border",
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
                    <p className={cn("mt-1 text-xs", featured ? "text-white/75" : "text-muted-foreground")}>
                      ${(price.amount / 12).toFixed(2)}/month, billed yearly
                    </p>
                  )}

                  <ul className="mt-6 grid flex-1 content-start gap-3 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check className={cn("mt-0.5 size-4 shrink-0", featured ? "text-white" : "text-success")} aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={cn("mt-8 w-full", featured && "bg-white text-navy hover:bg-white/90 dark:bg-primary dark:text-white dark:hover:bg-primary-hover")}
                    loading={busyPlan === plan.id}
                    onClick={() => buy(plan)}
                    aria-label={`Buy ${plan.name}, ${interval}`}
                  >
                    Buy now
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
          You&apos;re signed in with a browser-only account ({user.email}). Prices and limits are provisional and may change before launch.
        </p>
      </main>

      <Dialog open={notice !== null} onOpenChange={(open) => !open && setNotice(null)}>
        <DialogContent>
          {notice?.kind === "not-configured" && (
            <>
              <DialogHeader>
                <DialogTitle>Checkout isn&apos;t connected yet</DialogTitle>
                <DialogDescription>
                  Payments for the {notice.plan.name} plan go through Paddle, and this site doesn&apos;t have its Paddle settings yet. No
                  checkout was opened and nothing was charged.
                </DialogDescription>
              </DialogHeader>
              <div className="text-sm">
                <p className="font-medium">Missing settings</p>
                <ul className="mt-2 grid gap-1">
                  {notice.missing.map((m) => (
                    <li key={m}><code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{m}</code></li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {notice?.kind === "submitted" && (
            <DialogHeader>
              <DialogTitle>Payment submitted to Paddle</DialogTitle>
              <DialogDescription>
                Paddle will email your receipt for the {notice.plan.name} plan. Your plan becomes active in Aoient only after our server
                confirms the payment with Paddle, and that step needs the database, which isn&apos;t connected yet. Until then no paid
                features are unlocked.
              </DialogDescription>
            </DialogHeader>
          )}
          {notice?.kind === "error" && (
            <DialogHeader>
              <DialogTitle>Checkout unavailable</DialogTitle>
              <DialogDescription>{notice.message}</DialogDescription>
            </DialogHeader>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
