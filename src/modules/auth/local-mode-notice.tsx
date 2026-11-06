import Link from "next/link";
import { AuthCard } from "./auth-card";
import { Alert } from "@/components/ui/alert";

/** Shown on email-based auth pages while accounts are stored in the browser only. */
export function LocalModeNotice({ title }: { title: string }) {
  return (
    <AuthCard title={title} footer={<Link href="/sign-in" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
      <Alert tone="info" title="Not available in browser-only mode">
        Accounts are currently saved in this browser, so Aoient can&apos;t send emails or reset passwords. This
        arrives when the database is connected.
      </Alert>
    </AuthCard>
  );
}
