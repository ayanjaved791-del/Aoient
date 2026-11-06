import { NextResponse, type NextRequest } from "next/server";
import { processPaddleEvent, verifyPaddleSignature, type PaddleEvent } from "@/server/billing/paddle-webhook";

/**
 * Paddle → Aoient. Configure in Paddle: Developer tools → Notifications →
 * destination URL `<APP_URL>/api/webhooks/paddle`, events subscription.*.
 * Its secret key goes in PADDLE_WEBHOOK_SECRET (server-only).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    // Not configured: say so, and let Paddle retry later once it is.
    return NextResponse.json({ error: "PADDLE_WEBHOOK_SECRET is not set" }, { status: 503 });
  }
  const raw = await req.text();
  if (raw.length > 1_000_000 || !verifyPaddleSignature(raw, req.headers.get("paddle-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(raw) as PaddleEvent;
    if (typeof event.event_id !== "string" || typeof event.event_type !== "string" || typeof event.occurred_at !== "string") throw new Error();
  } catch {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  // Errors propagate as 500 so Paddle retries the event later.
  const outcome = await processPaddleEvent(event);
  return NextResponse.json({ received: true, outcome });
}
