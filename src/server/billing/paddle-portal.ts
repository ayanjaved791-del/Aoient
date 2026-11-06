import "server-only";
import { getDb } from "@/server/database/client";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { ConflictError } from "@/lib/errors";
import { paddleApiBase } from "./paddle-transactions";

/**
 * A one-time link to Paddle's customer portal for this organization's
 * subscription (change payment method, see invoices, cancel). Requires
 * billing.manage and the secret PADDLE_API_KEY; the customer ID comes from
 * our database (set by the verified webhook), never from the browser.
 */
export async function createBillingPortalUrl(ctx: OrgContext, fetchImpl: typeof fetch = fetch): Promise<string> {
  assertPermission(ctx, "billing.manage");
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new ConflictError("The billing portal isn't connected: this site is missing PADDLE_API_KEY.");
  const [row] = await getDb()<{ customer: string | null; subscription: string | null }[]>`
    select paddle_customer_id as customer, paddle_subscription_id as subscription
    from organization_license where organization_id = ${ctx.organizationId} and source = 'paddle'`;
  if (!row?.customer) throw new ConflictError("This workspace has no Paddle subscription yet.");

  const res = await fetchImpl(`${paddleApiBase()}/customers/${encodeURIComponent(row.customer)}/portal-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(row.subscription ? { subscription_ids: [row.subscription] } : {}),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { data?: { urls?: { general?: { overview?: string } } } } | null;
  const url = body?.data?.urls?.general?.overview;
  if (!res.ok || !url || !url.startsWith("https://")) throw new ConflictError("Paddle's billing portal didn't respond. Try again in a moment.");
  return url;
}
