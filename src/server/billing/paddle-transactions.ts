/**
 * Server-side confirmation of a Paddle transaction, used by the payment-success
 * page. The browser only tells us a transaction ID; this asks Paddle's API
 * (with the secret PADDLE_API_KEY) whether it was really paid, and only shows it
 * to the customer whose email it was billed to.
 *
 * This confirms a payment for display. It does NOT activate a plan: that must
 * come from Paddle's signed webhook, which isn't built yet.
 *
 * No `server-only` import so unit tests can run it; it is only imported by
 * server components.
 */
import { PLANS } from "@/lib/billing/plans";

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
  currency_code: string;
  custom_data?: { aoientPlan?: string; interval?: string } | null;
  invoice_number?: string | null;
  billed_at?: string | null;
  details?: { totals?: { grand_total?: string; total?: string; tax?: string } };
  items?: { price?: { name?: string | null } }[];
  customer?: { email?: string } | null;
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
    res = await fetchImpl(`${paddleApiBase(env)}/transactions/${transactionId}?include=customer`, {
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
      billedAt: txn.billed_at ?? null,
    },
  };
}
