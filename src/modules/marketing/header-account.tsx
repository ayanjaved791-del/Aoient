import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";

function SignedOut() {
  return (
    <>
      <Link
        href="/sign-in"
        className="hidden h-9 items-center rounded-full px-3 text-sm font-medium text-neutral-700 transition-colors hover:text-black sm:inline-flex dark:text-neutral-300 dark:hover:text-white"
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        data-magnetic
        className="shine inline-flex h-9 items-center rounded-full bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        Get started
      </Link>
    </>
  );
}

/** Streams in: visitors see Sign in / Get started, signed-in users get a link back into the app. */
export async function HeaderAccount() {
  // Per-request, never baked into the static page. Outside the catch so Next's
  // "render this at request time" signal isn't swallowed.
  await connection();
  const user = await getSessionUser().catch(() => null);
  if (!user) return <SignedOut />;
  return (
    <Link
      href="/organizations"
      data-magnetic
      className="shine group inline-flex h-9 items-center gap-1.5 rounded-full bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
    >
      Open app <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function HeaderAccountFallback() {
  return <SignedOut />;
}
