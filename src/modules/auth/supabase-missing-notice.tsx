import { Alert } from "@/components/ui/alert";
import { missingSupabaseConfig } from "@/lib/supabase/config";

/** Shown instead of auth forms while the Supabase project isn't connected. */
export function SupabaseMissingNotice() {
  return (
    <Alert tone="warning" title="Accounts aren't connected yet">
      Sign-up and sign-in run on Supabase, and this site doesn&apos;t have its Supabase settings yet. Missing:{" "}
      {missingSupabaseConfig().map((m, i) => (
        <span key={m}>
          {i > 0 && ", "}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">{m}</code>
        </span>
      ))}
      .
    </Alert>
  );
}
