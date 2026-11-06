import "server-only";
import { NextResponse } from "next/server";
import { AppError, ForbiddenError, RateLimitedError, ValidationError, isAppError } from "@/lib/errors";
import { requireUser, type SessionUser } from "@/server/auth/session";
import { resolveOrgContext, type OrgContext } from "@/server/tenancy/context";

/** Spec §15 envelopes. */
export function ok<T>(data: T, init?: { status?: number; meta?: Record<string, unknown> }) {
  return NextResponse.json({ data, ...(init?.meta ? { meta: init.meta } : {}) }, { status: init?.status ?? 200 });
}

export function errorResponse(e: unknown): NextResponse {
  if (isAppError(e)) {
    const body = { error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } };
    const headers = e instanceof RateLimitedError ? { "Retry-After": String(e.retryAfterSeconds) } : undefined;
    return NextResponse.json(body, { status: e.status, headers });
  }
  // Never leak stack traces or raw database errors.
  console.error("[api] unhandled error", e);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 });
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated mutations: the request must come from
 * our own origin. (Future API-key authenticated requests will bypass cookies
 * entirely and use a separate guard.)
 */
export function assertSameOrigin(req: Request): void {
  if (SAFE_METHODS.has(req.method)) return;
  const expected = new URL(process.env.APP_URL ?? req.url).origin;
  const origin = req.headers.get("origin");
  if (origin) {
    if (origin !== expected) throw new ForbiddenError("Cross-origin request rejected");
    return;
  }
  if (req.headers.get("sec-fetch-site") === "same-origin") return;
  throw new ForbiddenError("Cross-origin request rejected");
}

const MAX_JSON_BYTES = 100_000;

export async function readJson(req: Request): Promise<unknown> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_JSON_BYTES) throw new ValidationError("Request body is too large");
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new ValidationError("Request body is too large");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

type Params = Record<string, string>;
type RouteCtx<P extends Params> = { params: Promise<P> };

/** Authenticated route: session → handler. */
export function withUser<P extends Params>(handler: (args: { req: Request; user: SessionUser; params: P }) => Promise<Response>) {
  return async (req: Request, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const user = await requireUser();
      return await handler({ req, user, params: await ctx.params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/**
 * Tenant route: session → verified membership of `params.id` → handler.
 * The organization id in the URL is untrusted until `resolveOrgContext` proves membership.
 */
export function withOrg<P extends Params & { id: string }>(
  handler: (args: { req: Request; user: SessionUser; ctx: OrgContext; params: P }) => Promise<Response>,
) {
  return withUser<P>(async ({ req, user, params }) => {
    const ctx = await resolveOrgContext(user.id, { id: params.id });
    return handler({ req, user, ctx, params });
  });
}

export { AppError };
