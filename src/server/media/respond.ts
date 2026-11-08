import "server-only";
import { AppError } from "@/lib/errors";
import type { StoredImage } from "./media";

/** Image response for a signed-in viewer: private cache, no sniffing, no scripts. */
export async function imageResponse(load: () => Promise<StoredImage>): Promise<Response> {
  try {
    const img = await load();
    return new Response(new Uint8Array(img.data), {
      headers: {
        "content-type": img.contentType,
        // The URL changes with each new picture, so a long private cache is safe.
        "cache-control": "private, max-age=31536000, immutable",
        "content-security-policy": "default-src 'none'; sandbox",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    throw e;
  }
}
