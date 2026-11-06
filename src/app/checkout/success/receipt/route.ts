import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { lookupTransaction } from "@/server/billing/paddle-transactions";
import { buildReceiptPdf } from "@/server/billing/receipt-pdf";

/**
 * GET /checkout/success/receipt?txn=… → PDF receipt.
 * Same rules as the success page: signed in, and Paddle's API must confirm the
 * transaction is paid and was billed to this user's email. Anything else is 404.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in to download your receipt.", { status: 401 });

  const result = await lookupTransaction(req.nextUrl.searchParams.get("txn") ?? undefined, user.email);
  if (result.kind !== "paid") {
    const status = result.kind === "error" || result.kind === "not-configured" ? 503 : 404;
    return new Response(status === 503 ? "We couldn't confirm this payment with Paddle right now." : "Receipt not found.", { status });
  }

  const pdf = await buildReceiptPdf(result.details);
  const name = `aoient-receipt-${(result.details.invoiceNumber ?? result.details.id).replace(/[^A-Za-z0-9_-]/g, "")}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
