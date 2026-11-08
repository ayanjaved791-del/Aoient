import { connection } from "next/server";

/** GET /api/ping → 204. Lets the app tell "Wi-Fi on but no internet" from a real connection. */
export async function GET() {
  await connection();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
