"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { initializePaddle, type CheckoutEventsData, type Paddle, type PaddleEventData } from "@paddle/paddle-js";
import { ArrowLeft, Building2, Check, CircleCheck, Lock, Rocket, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import {
  ANNUAL_MONTHS_CHARGED,
  PADDLE_CLIENT_TOKEN,
  PADDLE_ENVIRONMENT,
  PLANS,
  missingCheckoutConfig,
  paddlePriceId,
  priceFor,
  yearlySavingPercent,
  type BillingInterval,
  type PlanId,
} from "@/lib/billing/plans";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ICONS = { medisea: Sparkles, indiana: Rocket, pacfic_deepdive: Building2 } as const;
const FRAME_CLASS = "aoient-paddle-frame";

type Status = "loading" | "ready" | "completed" | "error";

/** Paddle.js must be initialised once per page load; later calls reuse it. */
let paddlePromise: Promise<Paddle | undefined> | null = null;
let paddleListener: ((e: PaddleEventData) => void) | null = null;
function getPaddle() {
  paddlePromise ??= initializePaddle({
    environment: PADDLE_ENVIRONMENT,
    token: PADDLE_CLIENT_TOKEN!,
    eventCallback: (e) => paddleListener?.(e),
  });
  return paddlePromise;
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function CheckoutPage({
  planId,
  initialInterval,
  user,
}: {
  planId: PlanId;
  initialInterval: BillingInterval;
  user: { name: string; email: string };
}) {
  const plan = PLANS.find((p) => p.id === planId)!;
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [interval, setBillingInterval] = useState<BillingInterval>(initialInterval);
  const [status, setStatus] = useState<Status>("loading");
  const [checkout, setCheckout] = useState<CheckoutEventsData | null>(null);
  const paddleRef = useRef<Paddle | null>(null);
  const openedRef = useRef(false);

  const missing = missingCheckoutConfig(plan.id, interval);
  const priceId = paddlePriceId(plan.id, interval);
  const listPrice = priceFor(plan, interval);
  const Icon = ICONS[plan.id];
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  // Paddle events → page state. Paddle confirming a checkout in the browser is
  // NOT proof of payment: only a verified server-side webhook may grant access.
  useEffect(() => {
    paddleListener = (e) => {
      if (e.data) setCheckout(e.data);
      switch (e.name) {
        case "checkout.loaded":
          setStatus("ready");
          break;
        case "checkout.completed":
          setStatus("completed");
          // The success page re-checks this transaction with Paddle's API on the server.
          if (e.data?.transaction_id) router.push(`/checkout/success?txn=${encodeURIComponent(e.data.transaction_id)}`);
          break;
        case "checkout.error":
          setStatus("error");
          break;
      }
    };
    return () => {
      paddleListener = null;
    };
  }, [router]);

  // Open the inline checkout once (and again if the site theme changes).
  useEffect(() => {
    if (!resolvedTheme || !priceId || !PADDLE_CLIENT_TOKEN) return;
    let cancelled = false;
    getPaddle()
      .then((paddle) => {
        if (cancelled) return;
        if (!paddle) throw new Error("Paddle could not be loaded.");
        paddleRef.current = paddle;
        openedRef.current = true;
        paddle.Checkout.open({
          items: [{ priceId, quantity: 1 }],
          customer: { email: user.email },
          customData: { aoientPlan: plan.id, interval },
          settings: {
            displayMode: "inline",
            variant: "one-page",
            theme,
            frameTarget: FRAME_CLASS,
            frameInitialHeight: 450,
            frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;",
            allowLogout: false,
            showAddTaxId: true,
            showAddDiscounts: false,
          },
        });
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
    // The interval is switched in place with updateItems (below), not by reopening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  useEffect(() => () => paddleRef.current?.Checkout.close(), []);

  function changeInterval(next: BillingInterval) {
    if (next === interval || status === "completed") return;
    setBillingInterval(next);
    router.replace(`/checkout/${plan.id}?interval=${next}`, { scroll: false });
    const nextPrice = paddlePriceId(plan.id, next);
    if (openedRef.current && nextPrice) paddleRef.current?.Checkout.updateItems([{ priceId: nextPrice, quantity: 1 }]);
  }

  const totals = checkout?.totals;
  const currency = checkout?.currency_code ?? "USD";

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Aoient home" className="rounded-md"><Logo /></Link>
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Lock className="size-4" aria-hidden /> Secure checkout
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> All plans
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          {/* ── Order summary (Aoient design) ── */}
          <section
            aria-labelledby="summary-title"
            className="animate-rise-in relative isolate overflow-hidden rounded-2xl bg-navy p-6 text-white shadow-[0_30px_60px_-24px_rgba(16,24,40,0.55)] sm:p-8 lg:sticky lg:top-8 dark:border dark:border-border dark:bg-primary-subtle"
          >
            <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 -z-10 size-64 rounded-full bg-primary/40 blur-3xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 -z-10 size-56 rounded-full bg-fuchsia-500/20 blur-3xl" />

            <p className="text-xs font-medium uppercase tracking-widest text-white/60">Order summary</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                <Icon className="size-6" aria-hidden />
              </span>
              <div>
                <h1 id="summary-title" className="text-2xl font-semibold">{plan.name}</h1>
                <p className="text-sm text-white/70">{plan.tagline}</p>
              </div>
            </div>

            <div role="radiogroup" aria-label="Billing period" className="relative mt-6 grid grid-cols-2 rounded-full bg-white/10 p-1">
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  interval === "yearly" && "translate-x-full",
                )}
              />
              {(["monthly", "yearly"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={interval === value}
                  disabled={status === "completed"}
                  onClick={() => changeInterval(value)}
                  className={cn(
                    "relative z-10 rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                    interval === value ? "text-navy" : "text-white/75 hover:text-white",
                  )}
                >
                  {value}
                  {value === "yearly" && <span className="ml-1 text-[11px] opacity-70">−{yearlySavingPercent()}%</span>}
                </button>
              ))}
            </div>

            <ul className="mt-6 grid gap-2.5 text-sm">
              {plan.features.map((f, i) => (
                <li key={f} className="animate-fade-up flex gap-2.5" style={{ animationDelay: `${150 + i * 40}ms` }}>
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
                  <span className="text-white/90">{f}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-8 grid gap-2 border-t border-white/15 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/70">{plan.name} · {interval}</dt>
                <dd className="tabular-nums">{totals ? money(totals.subtotal, currency) : money(listPrice.amount, "USD")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/70">Tax</dt>
                <dd className="tabular-nums">{totals ? money(totals.tax, currency) : <span className="text-white/60">Calculated by Paddle</span>}</dd>
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-white/15 pt-4">
                <dt className="font-medium">Due today</dt>
                <dd key={`${interval}-${totals?.total}`} className="animate-price-pop text-3xl font-semibold tabular-nums">
                  {totals ? money(totals.total, currency) : money(listPrice.amount, "USD")}
                </dd>
              </div>
              <p className="text-right text-xs text-white/60">
                Then every {listPrice.per}
                {interval === "yearly" && ` · ${12 - ANNUAL_MONTHS_CHARGED} months free`} · cancel anytime
              </p>
            </dl>
          </section>

          {/* ── Payment (Paddle inline frame) ── */}
          <section aria-labelledby="payment-title" className="animate-rise-in rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="payment-title" className="text-lg font-semibold">Payment details</h2>
              {PADDLE_ENVIRONMENT === "sandbox" && (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Test mode · no real charges
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Paying as {user.email}</p>

            {missing.length > 0 ? (
              <div className="mt-6 rounded-xl border border-border bg-surface-muted p-4 text-sm">
                <p className="flex items-center gap-2 font-medium"><TriangleAlert className="size-4 text-amber-500" aria-hidden />Checkout isn&apos;t connected yet</p>
                <p className="mt-1 text-muted-foreground">This site is missing these Paddle settings, so no checkout was opened and nothing was charged:</p>
                <ul className="mt-3 grid gap-1">
                  {missing.map((m) => <li key={m}><code className="rounded bg-background px-1.5 py-0.5 text-xs">{m}</code></li>)}
                </ul>
              </div>
            ) : status === "completed" ? (
              <div className="animate-fade-up mt-6 rounded-xl border border-border bg-success-subtle p-5">
                <p className="flex items-center gap-2 font-semibold"><CircleCheck className="size-5 text-success" aria-hidden />Payment submitted to Paddle</p>
                <p className="mt-2 text-sm text-secondary-foreground">
                  Paddle will email your receipt{checkout?.customer?.email ? ` to ${checkout.customer.email}` : ""}. Your {plan.name} plan becomes
                  active in Aoient only after our server receives Paddle&apos;s signed confirmation of the payment. That confirmation step
                  isn&apos;t built yet, so no paid features are unlocked for now.
                </p>
                <Button asChild variant="secondary" className="mt-4"><Link href="/pricing">Back to plans</Link></Button>
              </div>
            ) : status === "error" ? (
              <div className="mt-6 rounded-xl border border-border bg-surface-muted p-4 text-sm">
                <p className="flex items-center gap-2 font-medium"><TriangleAlert className="size-4 text-danger" aria-hidden />The checkout couldn&apos;t load</p>
                <p className="mt-1 text-muted-foreground">Nothing was charged. Check your connection and reload the page.</p>
                <Button variant="secondary" className="mt-3" onClick={() => window.location.reload()}>Reload</Button>
              </div>
            ) : null}

            {missing.length === 0 && (
              <div className={cn("relative mt-4", (status === "completed" || status === "error") && "hidden")}>
                {status === "loading" && (
                  <div className="absolute inset-0 grid content-start gap-3" aria-busy="true" aria-label="Loading checkout">
                    <Skeleton className="h-11" />
                    <Skeleton className="h-11" />
                    <div className="grid grid-cols-2 gap-3"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
                    <Skeleton className="h-11" />
                    <Skeleton className="mt-2 h-12" />
                  </div>
                )}
                <div className={cn(FRAME_CLASS, "min-h-[450px] transition-opacity duration-500", status === "loading" ? "opacity-0" : "opacity-100")} />
              </div>
            )}

            <ul className="mt-6 grid gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-2">
              <li className="flex items-center gap-1.5"><ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />Card details go to Paddle, never to Aoient</li>
              <li className="flex items-center gap-1.5"><Lock className="size-4 shrink-0" aria-hidden />Paddle is the merchant of record and handles tax</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
