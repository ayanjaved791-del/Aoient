/**
 * Server-side confirmation of a Paddle transaction, used by the payment-success
 * page. The browser only tells us a transaction ID; this asks Paddle's API
 * (with the secret PADDLE_API_KEY) whether it was really paid, and only shows it
 * to the customer whose email it was billed to.
 *
 * This confirms a payment for display. Activation reads the subscription
 * itself from Paddle (paddle-sync.ts) or arrives by signed webhook.
 *
 * No `server-only` import so unit tests can run it; it is only imported by
 * server components.
 */
import { PLANS, priceFor } from "@/lib/billing/plans";

export type TransactionLookup =
  | { kind: "not-configured" }
  | { kind: "invalid" }
  | { kind: "not-found" }
  | { kind: "error" }
  | { kind: "pending"; id: string }
  | { kind: "paid"; details: PaidTransaction };

export interface PaidTransaction {
  id: string;
  planName: string;
  interval: "monthly" | "yearly" | null;
  /** Formatted grand total, e.g. "$79.00". */
  total: string;
  /** Formatted tax, e.g. "$0.00". */
  tax: string;
  email: string;
  invoiceNumber: string | null;
  billedAt: string | null;
  /** Formatted subtotal before tax. */
  subtotal: string;
  currency: string;
  customerName: string | null;
  /** One line, e.g. "1 Main St, London, SW1A 1AA, GB". */
  address: string | null;
  business: { name: string; taxId: string | null } | null;
  /** e.g. "Visa •••• 4242". */
  paymentMethod: string | null;
  period: { startsAt: string; endsAt: string } | null;
  lineItems: { name: string; quantity: number; amount: string }[];
  /**
   * Set when this checkout started a free trial (nothing charged today):
   * the trial length and when Paddle takes the first payment.
   */
  trial: { days: number; firstChargeAt: string | null } | null;
  /** From checkout custom_data: only a hint for linking; callers must verify membership. */
  organizationId: string | null;
  /** The subscription this checkout created, for the server-side license sync. */
  subscriptionId: string | null;
  /** The plan's recurring price from Paddle, e.g. { amount: "$29.00", per: "month" }. */
  price: { amount: string; per: string } | null;
  /** The next charge Paddle will take: after the trial, or at the end of this period. */
  nextPayment: { amount: string; date: string } | null;
  /** Paddle sandbox (test money) or production. */
  environment: "sandbox" | "production";
}

const TXN_ID = /^txn_[a-z0-9]{10,64}$/;
const PAID = new Set(["paid", "completed"]);
const PENDING = new Set(["draft", "ready", "billed"]);

export function paddleApiBase(env: Record<string, string | undefined> = process.env): string {
  return env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

/** Paddle amounts are strings in the currency's minor unit ("7900" = $79.00). */
export function formatMinor(amount: string | undefined, currency: string): string {
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  return fmt.format(Number(amount ?? 0) / 10 ** digits);
}

interface PaddleTransaction {
  id: string;
  status: string;
  subscription_id?: string | null;
  currency_code: string;
  custom_data?: { aoientPlan?: string; interval?: string; organizationId?: unknown } | null;
  invoice_number?: string | null;
  billed_at?: string | null;
  details?: {
    totals?: { grand_total?: string; total?: string; tax?: string; subtotal?: string };
    line_items?: { quantity?: number; totals?: { total?: string }; product?: { name?: string } | null }[];
  };
  items?: {
    quantity?: number;
    price?: {
      name?: string | null;
      trial_period?: { interval?: string; frequency?: number } | null;
      billing_cycle?: { interval?: string; frequency?: number } | null;
      unit_price?: { amount?: string; currency_code?: string } | null;
    };
  }[];
  customer?: { email?: string; name?: string | null } | null;
  address?: { first_line?: string | null; second_line?: string | null; city?: string | null; postal_code?: string | null; region?: string | null; country_code?: string | null } | null;
  business?: { name?: string | null; tax_identifier?: string | null } | null;
  payments?: { status?: string; captured_at?: string | null; method_details?: { type?: string; card?: { type?: string; last4?: string } | null } | null }[];
  billing_period?: { starts_at?: string; ends_at?: string } | null;
}

export async function lookupTransaction(
  transactionId: string | undefined,
  viewerEmail: string,
  opts: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
): Promise<TransactionLookup> {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!transactionId || !TXN_ID.test(transactionId)) return { kind: "invalid" };
  const apiKey = env.PADDLE_API_KEY;
  if (!apiKey) return { kind: "not-configured" };

  let res: Response;
  try {
    res = await fetchImpl(`${paddleApiBase(env)}/transactions/${transactionId}?include=customer,address,business`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 404) return { kind: "not-found" };
  if (!res.ok) return { kind: "error" };

  const body = (await res.json().catch(() => null)) as { data?: PaddleTransaction } | null;
  const txn = body?.data;
  if (!txn || txn.id !== transactionId) return { kind: "error" };

  // Only the customer who paid may see it. Same answer as "doesn't exist", so
  // transaction IDs can't be used to probe other people's purchases.
  const email = txn.customer?.email?.toLowerCase();
  if (!email || email !== viewerEmail.toLowerCase()) return { kind: "not-found" };

  if (PENDING.has(txn.status)) return { kind: "pending", id: txn.id };
  if (!PAID.has(txn.status)) return { kind: "not-found" };

  const plan = PLANS.find((p) => p.id === txn.custom_data?.aoientPlan);
  const interval = txn.custom_data?.interval === "yearly" ? "yearly" : txn.custom_data?.interval === "monthly" ? "monthly" : null;
  const totals = txn.details?.totals;
  const cur = txn.currency_code;
  const a = txn.address;
  const address = a ? [a.first_line, a.second_line, a.city, a.region, a.postal_code, a.country_code].filter(Boolean).join(", ") || null : null;
  const payment = txn.payments?.find((p) => p.status === "captured") ?? txn.payments?.[0];
  const card = payment?.method_details?.card;
  const paymentMethod = card?.last4
    ? `${titleCase(card.type ?? "Card")} •••• ${card.last4}`
    : payment?.method_details?.type
      ? titleCase(payment.method_details.type.replace(/_/g, " "))
      : null;
  const lineItems = (txn.details?.line_items ?? []).map((li) => ({
    name: li.product?.name ?? plan?.name ?? "Aoient plan",
    quantity: li.quantity ?? 1,
    amount: formatMinor(li.totals?.total, cur),
  }));
  return {
    kind: "paid",
    details: {
      id: txn.id,
      planName: plan?.name ?? txn.items?.[0]?.price?.name ?? "Aoient plan",
      interval,
      total: formatMinor(totals?.grand_total ?? totals?.total, txn.currency_code),
      tax: formatMinor(totals?.tax, txn.currency_code),
      email,
      invoiceNumber: txn.invoice_number ?? null,
      billedAt: payment?.captured_at ?? txn.billed_at ?? null,
      subtotal: formatMinor(totals?.subtotal, cur),
      currency: cur,
      customerName: txn.customer?.name ?? null,
      address,
      business: txn.business?.name ? { name: txn.business.name, taxId: txn.business.tax_identifier ?? null } : null,
      paymentMethod,
      period: txn.billing_period?.starts_at && txn.billing_period.ends_at ? { startsAt: txn.billing_period.starts_at, endsAt: txn.billing_period.ends_at } : null,
      lineItems,
      trial: trialInfo(txn),
      organizationId: typeof txn.custom_data?.organizationId === "string" ? txn.custom_data.organizationId : null,
      subscriptionId: txn.subscription_id ?? null,
      ...priceInfo(txn, plan, interval),
      environment: env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox",
    },
  };
}

/**
 * The recurring price comes from Paddle's own price object (what will really be
 * charged); our plan table is only a fallback when Paddle doesn't send it.
 */
function priceInfo(txn: PaddleTransaction, plan: (typeof PLANS)[number] | undefined, interval: "monthly" | "yearly" | null): Pick<PaidTransaction, "price" | "nextPayment"> {
  const item = txn.items?.[0];
  const unit = item?.price?.unit_price;
  const cycle = item?.price?.billing_cycle;
  const per = cycle?.interval ? `${cycle.frequency && cycle.frequency > 1 ? `${cycle.frequency} ` : ""}${cycle.interval}${cycle.frequency && cycle.frequency > 1 ? "s" : ""}` : interval === "yearly" ? "year" : interval === "monthly" ? "month" : null;
  let amount: string | null = null;
  if (unit?.amount) amount = formatMinor(String(Number(unit.amount) * (item?.quantity ?? 1)), unit.currency_code ?? txn.currency_code);
  else if (plan && interval) amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(priceFor(plan, interval).amount);
  const price = amount && per ? { amount, per } : null;
  const trial = trialInfo(txn);
  const nextDate = trial?.firstChargeAt ?? txn.billing_period?.ends_at ?? null;
  return { price, nextPayment: price && nextDate ? { amount: price.amount, date: nextDate } : null };
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const DAYS_PER: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

function trialInfo(txn: PaddleTransaction): PaidTransaction["trial"] {
  const tp = txn.items?.[0]?.price?.trial_period;
  const days = tp?.interval && tp.frequency ? (DAYS_PER[tp.interval] ?? 0) * tp.frequency : 0;
  const grand = Number(txn.details?.totals?.grand_total ?? txn.details?.totals?.total ?? 0);
  if (!days || grand !== 0) return null;
  return { days, firstChargeAt: txn.billing_period?.ends_at ?? null };
}
