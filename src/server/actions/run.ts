import "server-only";
import { isAppError, type ActionResult } from "@/lib/errors";

/** Converts thrown domain errors into a serialisable result for forms. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: { code: e.code, message: e.message, fields: e.fields } };
    console.error("[action] unhandled error", e);
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } };
  }
}
