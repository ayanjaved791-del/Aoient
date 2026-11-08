import Link from "next/link";
import { Check, Clock, CreditCard, Crown, ShieldCheck, Users } from "lucide-react";
import type { License, Usage } from "@/server/billing/license";
import { PLANS } from "@/lib/billing/plans";
import { daysLeft, licenseTimeline } from "@/lib/billing/entitlements";
import { priceFor } from "@/lib/billing/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ManageSubscriptionButton } from "./manage-subscription-button";
import { SyncPaddleButton } from "./sync-paddle-button";

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—");

export function licenseLabel(license: License | null): { text: string; tone: "success" | "primary" | "warning" | "danger" } {
  if (!license) return { text: "No plan", tone: "danger" };
  switch (license.state) {
    case "trial": {
      const d = daysLeft(license.trialEndsAt);
      const left = d === null ? "" : ` · ${d} day${d === 1 ? "" : "s"} left`;
      // A bought plan in Paddle's free trial is a subscription, not the app trial.
      return license.source === "paddle" ? { text: `Subscribed · free trial${left}`, tone: "success" } : { text: `Trial${left}`, tone: "primary" };
    }
    case "active":
      return { text: "Active", tone: "success" };
    case "past_due":
      return { text: "Payment issue", tone: "warning" };
    case "canceling":
      return { text: `Ends ${fmtDate(license.currentPeriodEndsAt)}`, tone: "warning" };
    case "expired":
      return { text: "Expired · read-only", tone: "danger" };
  }
}

export function LicenseView({
  slug,
  license,
  usage,
  canManage,
}: {
  slug: string;
  license: License | null;
  usage: Usage;
  canManage: boolean;
}) {
  const label = licenseLabel(license);
  const plan = license ? PLANS.find((p) => p.id === license.plan) : undefined;
  const e = license?.entitlements;
  const paid = license?.source === "paddle" && license.state !== "expired";
  const timeline = licenseTimeline(license);
  const firstCharge = plan && license?.billingInterval ? priceFor(plan, license.billingInterval) : null;
  const interval = license?.billingInterval === "yearly" ? "Yearly" : "Monthly";
  const details: [string, string][] =
    timeline.kind === "app-trial"
      ? [["Billing", "Free trial, no card"], ["Trial ends", fmtDate(timeline.trialEndsAt)], ["Payments", "—"]]
      : timeline.kind === "paid-trial"
        ? [["Billing", interval], ["First payment", fmtDate(timeline.firstChargeAt)], ["Covered until", fmtDate(timeline.coveredUntil)]]
        : timeline.kind === "paid"
          ? [["Billing", interval], ["Renews", fmtDate(timeline.renewsAt)], ["Payments", "Paddle"]]
          : timeline.kind === "ending"
            ? [["Billing", "Canceled"], ["Access until", fmtDate(timeline.endsAt)], ["Payments", "Paddle"]]
            : [["Billing", "—"], ["Ended", fmtDate(license?.trialEndsAt ?? license?.currentPeriodEndsAt ?? null)], ["Payments", "—"]];
  const seatsUsed = usage.activeMembers + usage.pendingInvitations;

  return (
    <div className="grid gap-6">
      <Card className="relative overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/15 blur-3xl" />
        <CardContent className="relative flex flex-wrap items-start justify-between gap-4 py-6">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-subtle text-primary"><Crown className="size-6" aria-hidden /></span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current plan</p>
              <p className="text-2xl font-semibold">{license ? (license.source === "trial" ? `${plan?.name ?? license.planName} trial` : plan?.name ?? license.planName) : "None"}</p>
            </div>
          </div>
          <Badge tone={label.tone} className="text-sm">{label.text}</Badge>
          <dl className="grid w-full gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            {details.map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {timeline.kind === "paid-trial" && (
            <p className="w-full rounded-lg bg-success-subtle px-3 py-2 text-sm text-secondary-foreground">
              Your {plan?.name} plan is active and starts with a free trial. Paddle charges
              {firstCharge ? ` $${firstCharge.amount}` : " the first payment"} on {fmtDate(timeline.firstChargeAt)}, which covers you until{" "}
              {fmtDate(timeline.coveredUntil)}
              {timeline.coveredUntil ? ` (${daysLeft(timeline.coveredUntil)} days of access from today)` : ""}. Cancel before{" "}
              {fmtDate(timeline.firstChargeAt)} and you won&apos;t be charged.
            </p>
          )}
          {license?.state === "expired" && (
            <p className="w-full rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">
              This workspace is read-only: your data is safe and visible, but changes are paused until a plan is active.
            </p>
          )}
          {license?.state === "past_due" && (
            <p className="w-full rounded-lg bg-warning-subtle px-3 py-2 text-sm text-warning">
              Paddle couldn&apos;t take the last payment and will retry. Update your payment method to avoid interruption.
            </p>
          )}
          <div className="flex w-full flex-wrap gap-3">
            {canManage && !paid && (
              <Button asChild><Link href={`/pricing?org=${slug}`}><CreditCard className="size-4" aria-hidden />{license?.state === "trial" ? "Choose a plan" : "Buy a plan"}</Link></Button>
            )}
            {canManage && license?.source === "paddle" && <ManageSubscriptionButton slug={slug} />}
            {canManage && <SyncPaddleButton slug={slug} label={license?.source === "paddle" ? "Refresh from Paddle" : "Already paid? Sync with Paddle"} />}
            {!canManage && <p className="text-sm text-muted-foreground">Only members whose role includes billing management can change the plan.</p>}
          </div>
        </CardContent>
      </Card>

      {e && (
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>Limits of the {plan?.name ?? license?.planName} plan, checked by the server on every change.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3">
            <Meter icon={Users} label="Users" hint="Members + pending invitations" used={seatsUsed} max={e.maxMembers} />
            <Meter icon={ShieldCheck} label="Admin seats" hint="Owner or Admin role" used={usage.adminSeats} max={e.maxAdminSeats} />
            <div className="grid content-start gap-2">
              <p className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-muted-foreground" aria-hidden />Custom roles</p>
              <p className="text-2xl font-semibold tabular-nums">{e.customRoles ? usage.customRoles : "—"}</p>
              <p className="text-xs text-muted-foreground">{e.customRoles ? "Included in your plan" : "Indiana plan and above"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s included</CardTitle>
            <CardDescription>
              Users, admin seats and custom roles are enforced today. Project and automation limits apply when those modules are released.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2.5 text-sm sm:grid-cols-2">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Meter({ icon: Icon, label, hint, used, max }: { icon: typeof Users; label: string; hint: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  const full = used >= max;
  return (
    <div className="grid content-start gap-2">
      <p className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-muted-foreground" aria-hidden />{label}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {used}<span className="text-base font-normal text-muted-foreground"> / {max}</span>
      </p>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={used}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-700", full ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{full ? "Limit reached" : hint}</p>
    </div>
  );
}

/** Thin bar under the workspace header for trial / payment / expiry states. */
export function LicenseBanner({ slug, license, canManage }: { slug: string; license: License | null; canManage: boolean }) {
  // Nothing to nag about once a plan is bought (including its free trial).
  if (license?.state === "active" || (license?.state === "trial" && license.source === "paddle")) return null;
  const label = licenseLabel(license);
  // Billing managers can act on it; everyone else is told who can.
  const message =
    !license || license.state === "expired"
      ? canManage
        ? "Your trial or subscription has ended. This workspace is read-only until a plan is active."
        : "This workspace is read-only because its plan has ended. You can still view everything; ask the workspace owner to choose a plan to make changes again."
      : license.state === "trial"
        ? `${canManage ? "You're" : "This workspace is"} on a free ${license.planName} trial. ${label.text.replace("Trial · ", "")}.`
        : license.state === "past_due"
          ? canManage
            ? "There's a problem with your last payment. Paddle will retry; update your payment method to avoid interruption."
            : "There's a problem with this workspace's last payment. Ask the workspace owner to update the payment method."
          : `${canManage ? "Your" : "This workspace's"} subscription is canceled and ends on ${fmtDate(license.currentPeriodEndsAt)}.`;
  const tone = !license || license.state === "expired" ? "bg-danger-subtle text-danger" : license.state === "trial" ? "bg-primary-subtle text-primary" : "bg-warning-subtle text-warning";
  return (
    <div className={cn("border-b border-border", tone)}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <Clock className="size-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">{message}</p>
        {canManage && (
          <Link href={`/${slug}/settings/billing`} className="shrink-0 font-semibold underline-offset-4 hover:underline">
            {license?.state === "trial" || !license || license.state === "expired" ? "Choose a plan →" : "Manage billing →"}
          </Link>
        )}
      </div>
    </div>
  );
}
