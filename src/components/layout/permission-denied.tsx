import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function PermissionDenied({ what = "this page" }: { what?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <EmptyState icon={Lock} title="You don't have access" description={`Your role doesn't include permission to view ${what}. Ask an organization admin if you need access.`} />
    </div>
  );
}
