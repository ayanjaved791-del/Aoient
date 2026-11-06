import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

/**
 * Shared 404. Also shown for organizations the user is not a member of, with
 * identical wording, so a URL cannot be used to discover other tenants.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo />
      <div className="grid gap-1.5">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">This page doesn&apos;t exist, or your account doesn&apos;t have access to it.</p>
      </div>
      <Button asChild variant="secondary"><Link href="/organizations">Go to your organizations</Link></Button>
    </div>
  );
}
