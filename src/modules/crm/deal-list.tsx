import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DealRow } from "@/server/crm/deals";
import { money } from "./labels";

/** A compact list of deals for contact and company pages. */
export function DealList({ base, deals, empty }: { base: string; deals: DealRow[]; empty: string }) {
  if (deals.length === 0) return <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-3 divide-y divide-border">
      {deals.map((d) => (
        <li key={d.id}>
          <Link href={`${base}/deals/${d.id}`} className="group flex items-center gap-3 py-3">
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium group-hover:underline">{d.title}</span>
              <span className="truncate text-xs text-muted-foreground">{[d.contact?.name, d.owner?.name].filter(Boolean).join(" · ") || "—"}</span>
            </span>
            <Badge tone={d.stage.kind === "won" ? "success" : d.stage.kind === "lost" ? "danger" : "neutral"}>{d.stage.name}</Badge>
            <span className="w-24 text-right text-sm font-semibold tabular-nums">{money(d.amount, d.currency, true)}</span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
