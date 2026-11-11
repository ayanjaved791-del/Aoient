"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Something failed inside a workspace page. The sidebar stays, so people can move on. People see a calm message and can try
 * again; the details stay in the server logs (never shown here).
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="grid gap-1.5">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">This page couldn&apos;t load just now. Your data is safe. Try again, and if it keeps happening, let us know the code below.</p>
        {error.digest && <p className="font-mono text-xs text-muted-foreground">Code: {error.digest}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}><RotateCcw />Try again</Button>
        <Button asChild variant="secondary"><Link href={`/${organizationSlug}`}>Back to the dashboard</Link></Button>
      </div>
    </div>
  );
}
