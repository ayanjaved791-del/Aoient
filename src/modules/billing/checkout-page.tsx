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
import { addInterval } from "@/lib/billing/entitlements";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TermsConsent } from "@/modules/legal/terms-consent";
import { startCheckoutAction } from "./actions";

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

/** Decided on the server: which workspace this checkout pays for, or why it can't start. */
export type CheckoutTarget =
  | { kind: "ready"; organization: { id: string; name: string; slug: string } }
  | { kind: "choose"; organizations: { id: string; name: string; slug: string }[] }
  | { kind: "no-organization" }
  | { kind: "already-subscribed"; organization: { name: string; slug: string } }
  | { kind: "not-configured"; organization: { name: string; slug: string } };

export function CheckoutPage({
  planId,
  initialInterval,
  user,
  target,
}: {
  planId: PlanId;
  initialInterval: BillingInterval;
  user: { name: string; email: string };
  target: CheckoutTarget;
}) {
  const plan = PLANS.find((p) => p.id === planId)!;
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [interval, setBillingInterval] = useState<BillingInterval>(initialInterval);
  const [status, setStatus] = useState<Status>("loading");
  const [checkout, setCheckout] = useState<CheckoutEventsData | null>(null);
  // Fixed when the page opens, so trial dates don't shift between renders.
  const [openedAt] = useState(() => Date.now());
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
  const [checkoutToken, setCheckoutToken] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function continueToPayment() {
    if (target.kind !== "ready") return;
    if (!agree) return setAgreeError("Please agree to the Terms of Service and Privacy Policy before paying.");
    setStarting(true);
    const res = await startCheckoutAction(target.organization.slug, true);
    setStarting(false);
    if (res.ok) setCheckoutToken(res.data.checkoutToken);
    else setAgreeError(res.error.message);
  }
  const paddleRef = useRef<Paddle | null>(null);
  const openedRef = useRef(false);

  const missing = missingCheckoutConfig(plan.id, interval);
  const ready = target.kind === "ready" && missing.length === 0;
  const orgParam = target.kind === "ready" ? `&org=${encodeURIComponent(target.organization.slug)}` : "";
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
    if (!resolvedTheme || !priceId || !PADDLE_CLIENT_TOKEN || target.kind !== "ready" || !checkoutToken) return;
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
          // The webhook trusts organizationId only together with the server-signed token.
          customData: { aoientPlan: plan.id, interval, organizationId: target.organization.id, checkoutToken },
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
  }, [resolvedTheme, checkoutToken]);

  useEffect(() => () => paddleRef.current?.Checkout.close(), []);

  function changeInterval(next: BillingInterval) {
    if (next === interval || status === "completed") return;
    setBillingInterval(next);
    router.replace(`/checkout/${plan.id}?interval=${next}${orgParam}`, { scroll: false });
    const nextPrice = paddlePriceId(plan.id, next);
    if (openedRef.current && nextPrice) paddleRef.current?.Checkout.updateItems([{ priceId: nextPrice, quantity: 1 }]);
  }

  const totals = checkout?.totals;
  // Paddle tells us when the price starts with a free trial (e.g. Medisea monthly: 14 days).
  const tp = checkout?.items?.[0]?.trial_period;
  const trialDays = tp ? ({ day: 1, week: 7, month: 30, year: 365 } as Record<string, number>)[tp.interval] * tp.frequency : 0;
  const firstCharge = trialDays ? new Date(openedAt + trialDays * 86_400_000) : null;
  const coveredUntil = firstCharge ? addInterval(firstCharge, interval) : null;
  const recurring = checkout?.recurring_totals ?? checkout?.items?.[0]?.recurring_totals;
  const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
              {firstCharge && coveredUntil ? (
                <div className="mt-3 grid gap-1.5 rounded-xl bg-white/10 p-3 text-xs">
                  <p className="flex justify-between"><span className="text-white/70">Free trial</span><span>{trialDays} days</span></p>
                  <p className="flex justify-between">
                    <span className="text-white/70">First payment</span>
                    <span className="tabular-nums">{money(recurring?.total ?? listPrice.amount, recurring ? currency : "USD")} on {shortDate(firstCharge)}</span>
                  </p>
                  <p className="flex justify-between"><span className="text-white/70">Covered until</span><span>{shortDate(coveredUntil)}</span></p>
                  <p className="mt-1 text-white/60">
                    {Math.round((coveredUntil.getTime() - openedAt) / 86_400_000)} days of {plan.name} in total. Cancel before {shortDate(firstCharge)} and
                    you won&apos;t be charged.
                  </p>
                </div>
              ) : (
                <p className="text-right text-xs text-white/60">
                  Then every {listPrice.per}
                  {interval === "yearly" && ` · ${12 - ANNUAL_MONTHS_CHARGED} months free`} · cancel anytime
                </p>
              )}
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
            <p className="mt-1 text-sm text-muted-foreground">
              {target.kind === "ready" ? <>For <span className="font-medium text-foreground">{target.organization.name}</span> · paying as {user.email}</> : <>Paying as {user.email}</>}
            </p>

            {target.kind !== "ready" ? (
              <TargetNotice target={target} planId={plan.id} interval={interval} />
            ) : missing.length > 0 ? (
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
                  active in Aoient as soon as our server receives Paddle&apos;s signed confirmation, usually within a minute.
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

            {ready && !checkoutToken && (
              <div className="mt-6 grid gap-4">
                <TermsConsent checked={agree} onChange={(v) => { setAgree(v); if (v) setAgreeError(null); }} error={agreeError} purpose="buy this plan" />
                <ul className="grid gap-1.5 text-xs text-muted-foreground">
                  <li>• Paddle is the merchant of record: it charges your card, issues the invoice and handles tax.</li>
                  <li>• Subscriptions renew automatically until you cancel; cancelling keeps access until the paid period ends.</li>
                </ul>
                <Button size="lg" onClick={continueToPayment} loading={starting} disabled={!agree}>
                  <Lock className="size-4" aria-hidden />Continue to payment
                </Button>
              </div>
            )}

            {ready && checkoutToken && (
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

function TargetNotice({ target, planId, interval }: { target: Exclude<CheckoutTarget, { kind: "ready" }>; planId: PlanId; interval: BillingInterval }) {
  const box = "mt-6 rounded-xl border border-border bg-surface-muted p-4 text-sm";
  switch (target.kind) {
    case "choose":
      return (
        <div className={box}>
          <p className="font-medium">Which workspace is this plan for?</p>
          <p className="mt-1 text-muted-foreground">You manage billing for more than one workspace. Each one has its own plan.</p>
          <ul className="mt-3 grid gap-2">
            {target.organizations.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/checkout/${planId}?interval=${interval}&org=${encodeURIComponent(o.slug)}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 font-medium transition-colors hover:border-primary"
                >
                  {o.name}
                  <span className="text-xs text-muted-foreground">/{o.slug}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      );
    case "no-organization":
      return (
        <div className={box}>
          <p className="font-medium">Create a workspace first</p>
          <p className="mt-1 text-muted-foreground">
            A plan belongs to a workspace. Create one (it starts with a free 14-day trial), or ask a workspace owner to buy the plan.
          </p>
          <Button asChild className="mt-3"><Link href="/organizations/new">Create a workspace</Link></Button>
        </div>
      );
    case "already-subscribed":
      return (
        <div className={box}>
          <p className="font-medium">{target.organization.name} already has a subscription</p>
          <p className="mt-1 text-muted-foreground">To change plan, payment method or cancel, use the billing page so you aren&apos;t charged twice.</p>
          <Button asChild className="mt-3"><Link href={`/${target.organization.slug}/settings/billing`}>Open billing</Link></Button>
        </div>
      );
    case "not-configured":
      return (
        <div className={box}>
          <p className="flex items-center gap-2 font-medium"><TriangleAlert className="size-4 text-amber-500" aria-hidden />Plan activation isn&apos;t connected yet</p>
          <p className="mt-1 text-muted-foreground">
            This site is missing <code className="rounded bg-background px-1.5 py-0.5 text-xs">PADDLE_WEBHOOK_SECRET</code>, so a payment couldn&apos;t be
            applied to {target.organization.name}. No checkout was opened and nothing was charged.
          </p>
        </div>
      );
  }
}
