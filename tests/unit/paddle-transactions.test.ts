import { describe, expect, it, vi } from "vitest";
import { formatMinor, lookupTransaction, paddleApiBase } from "@/server/billing/paddle-transactions";

const TXN = "txn_01hv8x9q2k3m4n5p6r7s8t9v0w";
const ENV = { PADDLE_API_KEY: "pdl_sdbx_apikey_test", NEXT_PUBLIC_PADDLE_ENVIRONMENT: "sandbox" };

function paddleReturns(status: number, data?: Record<string, unknown>) {
  return vi.fn(async () => new Response(JSON.stringify({ data }), { status }));
}

const paidTxn = (overrides: Record<string, unknown> = {}) => ({
  id: TXN,
  status: "completed",
  currency_code: "USD",
  custom_data: { aoientPlan: "indiana", interval: "monthly" },
  invoice_number: "325-10566",
  billed_at: "2026-11-07T10:00:00Z",
  details: { totals: { grand_total: "7900", tax: "0" } },
  customer: { email: "Owner@Example.com" },
  ...overrides,
});

describe("lookupTransaction", () => {
  it("confirms a paid transaction for the customer who paid, via Paddle's API with the secret key", async () => {
    const fetchImpl = paddleReturns(200, paidTxn());
    const result = await lookupTransaction(TXN, "owner@example.com", { env: ENV, fetchImpl });
    expect(result).toMatchObject({
      kind: "paid",
      details: { id: TXN, planName: "Indiana", interval: "monthly", total: "$79.00", tax: "$0.00", invoiceNumber: "325-10566" },
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://sandbox-api.paddle.com/transactions/${TXN}?include=customer`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer pdl_sdbx_apikey_test");
  });

  it("hides another customer's transaction (same answer as a missing one)", async () => {
    const result = await lookupTransaction(TXN, "someone-else@example.com", { env: ENV, fetchImpl: paddleReturns(200, paidTxn()) });
    expect(result).toEqual({ kind: "not-found" });
  });

  it("never reports success for unpaid transactions", async () => {
    for (const status of ["draft", "ready", "billed"]) {
      const r = await lookupTransaction(TXN, "owner@example.com", { env: ENV, fetchImpl: paddleReturns(200, paidTxn({ status })) });
      expect(r.kind).toBe("pending");
    }
    for (const status of ["canceled", "past_due"]) {
      const r = await lookupTransaction(TXN, "owner@example.com", { env: ENV, fetchImpl: paddleReturns(200, paidTxn({ status })) });
      expect(r.kind).toBe("not-found");
    }
  });

  it("rejects malformed IDs without calling Paddle", async () => {
    const fetchImpl = paddleReturns(200, paidTxn());
    for (const id of [undefined, "", "txn_../../customers", "pri_01abc", "txn_ABC"]) {
      expect(await lookupTransaction(id, "owner@example.com", { env: ENV, fetchImpl })).toEqual({ kind: "invalid" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("says so honestly when the API key is missing or Paddle fails", async () => {
    expect(await lookupTransaction(TXN, "owner@example.com", { env: {}, fetchImpl: paddleReturns(200, paidTxn()) })).toEqual({ kind: "not-configured" });
    expect(await lookupTransaction(TXN, "owner@example.com", { env: ENV, fetchImpl: paddleReturns(404) })).toEqual({ kind: "not-found" });
    expect(await lookupTransaction(TXN, "owner@example.com", { env: ENV, fetchImpl: paddleReturns(500) })).toEqual({ kind: "error" });
    const offline = vi.fn(async () => { throw new Error("network"); });
    expect(await lookupTransaction(TXN, "owner@example.com", { env: ENV, fetchImpl: offline })).toEqual({ kind: "error" });
    // A response for a different transaction is not trusted.
    expect(await lookupTransaction(TXN, "owner@example.com", { env: ENV, fetchImpl: paddleReturns(200, paidTxn({ id: "txn_01other00000000000000000" })) })).toEqual({ kind: "error" });
  });
});

describe("paddle helpers", () => {
  it("uses the sandbox API unless the environment is production", () => {
    expect(paddleApiBase({})).toBe("https://sandbox-api.paddle.com");
    expect(paddleApiBase({ NEXT_PUBLIC_PADDLE_ENVIRONMENT: "production" })).toBe("https://api.paddle.com");
  });
  it("formats minor-unit amounts per currency", () => {
    expect(formatMinor("7900", "USD")).toBe("$79.00");
    expect(formatMinor("1500", "JPY")).toBe("¥1,500");
  });
});
