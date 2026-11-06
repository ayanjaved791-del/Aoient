import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Clock, Download, FileText, Hourglass, Receipt, SearchX, TriangleAlert } from "lucide-react";
import type { PaidTransaction, TransactionLookup } from "@/server/billing/paddle-transactions";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "./auto-refresh";
import { PLANS, priceFor } from "@/lib/billing/plans";
import { addInterval } from "@/lib/billing/entitlements";

const CONFETTI_COLORS = ["#7c3aed", "#d946ef", "#fb923c", "#22d3ee", "#12b76a", "#facc15"];

/** Deterministic confetti (no Math.random, so server and client render the same). */
const CONFETTI = Array.from({ length: 48 }, (_, i) => {
  const r = (n: number) => ((i * 9301 + n * 49297) % 233280) / 233280;
  return {
    left: `${(r(1) * 100).toFixed(2)}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    w: 6 + Math.round(r(2) * 6),
    h: 8 + Math.round(r(3) * 8),
    round: i % 5 === 0,
    style: {
      "--delay": `${(r(4) * 1.6).toFixed(2)}s`,
      "--dur": `${(3.2 + r(5) * 2.6).toFixed(2)}s`,
      "--drift": `${Math.round((r(6) - 0.5) * 220)}px`,
      "--spin": `${Math.round(360 + r(7) * 720) * (i % 2 ? 1 : -1)}deg`,
    } as CSSProperties,
  };
});

type Workspace = { name: string; slug: string } | null;

export function PaymentSuccess({
  result,
  firstName,
  retryHref,
  workspace = null,
}: {
  result: TransactionLookup;
  firstName: string;
  retryHref: string;
  workspace?: Workspace;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <header className="relative z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" aria-label="Aoient home" className="rounded-md"><Logo /></Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        {result.kind === "paid" ? <Paid details={result.details} firstName={firstName} workspace={workspace} /> : <NotConfirmed result={result} retryHref={retryHref} />}
      </main>
    </div>
  );
}

const longDate = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function Paid({ details, firstName, workspace }: { details: PaidTransaction; firstName: string; workspace: Workspace }) {
  const plan = PLANS.find((p) => p.name === details.planName);
  const trial = details.trial;
  const firstCharge = trial?.firstChargeAt ? new Date(trial.firstChargeAt) : null;
  const coveredUntil = firstCharge && details.interval ? addInterval(firstCharge, details.interval) : null;
  const nextPrice = plan && details.interval ? `$${priceFor(plan, details.interval).amount}` : null;
  const rows: [string, ReactNode][] = [
    ["Plan", <span key="plan">{details.planName}{details.interval && <span className="text-muted-foreground"> · {details.interval}</span>}</span>],
    ...(trial
      ? ([
          ["Due today", <span key="due" className="font-semibold">{details.total}</span>],
          ["Free trial", `${trial.days} days`],
          ...(firstCharge ? ([["First payment", `${nextPrice ? `${nextPrice} on ` : ""}${longDate(firstCharge)}`]] as [string, ReactNode][]) : []),
          ...(coveredUntil ? ([["Covered until", longDate(coveredUntil)]] as [string, ReactNode][]) : []),
        ] as [string, ReactNode][])
      : ([
          ["Amount paid", <span key="amount" className="font-semibold">{details.total}</span>],
          ["Tax included", details.tax],
        ] as [string, ReactNode][])),
    ...(details.paymentMethod ? ([["Payment method", details.paymentMethod]] as [string, ReactNode][]) : []),
    ...(details.invoiceNumber ? ([["Invoice", details.invoiceNumber]] as [string, ReactNode][]) : []),
    ...(details.billedAt
      ? ([["Date", new Date(details.billedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })]] as [string, ReactNode][])
      : []),
    ["Transaction ID", <code key="txn" className="break-all text-xs">{details.id}</code>],
  ];

  return (
    <>
      {/* Confetti + glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <span className="absolute left-1/2 top-24 size-[520px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="absolute top-0 opacity-0 motion-safe:animate-confetti"
            style={{ ...c.style, left: c.left, width: c.w, height: c.round ? c.w : c.h, background: c.color, borderRadius: c.round ? "9999px" : "2px" }}
          />
        ))}
      </div>

      <div className="text-center">
        <div className="relative mx-auto flex size-24 items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-success/30 motion-safe:animate-ring-out" />
          <span className="animate-check-pop relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-success shadow-[0_20px_40px_-12px_rgba(18,183,106,0.6)]">
            <svg viewBox="0 0 24 24" className="size-11" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" className="animate-check-draw" />
            </svg>
          </span>
        </div>

        <p className="animate-fade-up mt-8 text-sm font-medium uppercase tracking-widest text-success" style={{ animationDelay: "350ms" }}>
          {trial ? "Subscription started" : "Payment successful"}
        </p>
        <h1 className="animate-fade-up mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl" style={{ animationDelay: "450ms" }}>
          Congratulations{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="animate-fade-up mx-auto mt-4 max-w-md text-balance text-muted-foreground" style={{ animationDelay: "550ms" }}>
          {trial ? (
            <>
              Your <span className="font-medium text-foreground">{details.planName}</span> plan is active with a <span className="whitespace-nowrap">{trial.days}-day</span> free trial.
              Nothing was charged today{firstCharge ? `; your first payment is on ${longDate(firstCharge)}` : ""}.
            </>
          ) : (
            <>
              Your payment for <span className="font-medium text-foreground">{details.planName}</span> went through. Thank you for choosing Aoient.
            </>
          )}
        </p>
      </div>

      <section aria-label="Receipt" className="animate-rise-in mt-10 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_48px_-24px_rgba(16,24,40,0.3)]" style={{ animationDelay: "650ms" }}>
        <div className="flex items-center gap-2 border-b border-border px-5 py-4 sm:px-6">
          <Receipt className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Receipt</h2>
          <span className="ml-auto text-xs text-muted-foreground">Confirmed by Paddle</span>
        </div>
        <dl className="divide-y divide-border text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-6 px-5 py-3 sm:px-6">
              <dt className="shrink-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-3 bg-surface-muted px-5 py-4 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary"><FileText className="size-5" aria-hidden /></span>
          <div className="min-w-[12rem] flex-1">
            <p className="text-sm font-medium">PDF receipt</p>
            <p className="text-xs text-muted-foreground">All payment details in one document. Paddle, our merchant of record, issues the tax invoice.</p>
          </div>
          <Button asChild className="group w-full sm:w-auto">
            {/* A plain link: the browser downloads the file the server generates after re-checking with Paddle. */}
            <a href={`/checkout/success/receipt?txn=${encodeURIComponent(details.id)}`} download>
              <Download className="size-4 transition-transform group-hover:translate-y-0.5" aria-hidden />Download PDF
            </a>
          </Button>
        </div>
      </section>

      <section className="animate-fade-up mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6" style={{ animationDelay: "800ms" }}>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Clock className="size-4 text-primary" aria-hidden />What happens next</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Paddle confirms the subscription to our server, which applies the {details.planName} plan to{" "}
          {workspace ? <span className="font-medium text-foreground">{workspace.name}</span> : "your workspace"} automatically, usually within a
          minute. {trial && coveredUntil
            ? `Your free trial and first ${details.interval === "yearly" ? "year" : "month"} together cover you until ${longDate(coveredUntil)}. Cancel before ${longDate(firstCharge!)} and you won't be charged.`
            : "You can see it any time under Settings → Billing & plan."}
        </p>
      </section>

      <div className="animate-fade-up mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "900ms" }}>
        <Button asChild className="group">
          <Link href={workspace ? `/${workspace.slug}/settings/billing` : "/organizations"}>{workspace ? "See your plan" : "Go to your workspace"}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link>
        </Button>
        <Button asChild variant="secondary"><Link href="/pricing">Back to plans</Link></Button>
      </div>
    </>
  );
}

function NotConfirmed({ result, retryHref }: { result: Exclude<TransactionLookup, { kind: "paid" }>; retryHref: string }) {
  const content = {
    pending: {
      icon: Hourglass,
      title: "Your payment is processing",
      body: "Paddle is still confirming this payment. This page checks again automatically; it usually takes a few seconds.",
    },
    "not-configured": {
      icon: TriangleAlert,
      title: "We can't confirm this payment yet",
      body: "This site doesn't have its Paddle API key (PADDLE_API_KEY), so it can't check the payment with Paddle. If you paid, Paddle has emailed your receipt.",
    },
    error: {
      icon: TriangleAlert,
      title: "We couldn't reach Paddle",
      body: "Your payment may still have gone through; Paddle emails a receipt when it does. Reload this page in a moment to check again.",
    },
    "not-found": {
      icon: SearchX,
      title: "We couldn't find this payment",
      body: "No completed payment with this ID belongs to your account. If you were charged, Paddle has emailed you a receipt.",
    },
    invalid: {
      icon: SearchX,
      title: "We couldn't find this payment",
      body: "This link doesn't contain a valid payment reference.",
    },
  }[result.kind];
  const Icon = content.icon;
  return (
    <div className="animate-rise-in rounded-2xl border border-border bg-surface p-8 text-center">
      {result.kind === "pending" && <AutoRefresh everyMs={3000} maxTimes={10} />}
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-muted">
        <Icon className={result.kind === "pending" ? "size-6 text-primary motion-safe:animate-pulse" : "size-6 text-muted-foreground"} aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">{content.title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{content.body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {result.kind !== "pending" && result.kind !== "invalid" && result.kind !== "not-found" && (
          <Button asChild><Link href={retryHref} prefetch={false}>Check again</Link></Button>
        )}
        <Button asChild variant="secondary"><Link href="/pricing">Back to plans</Link></Button>
      </div>
    </div>
  );
}
