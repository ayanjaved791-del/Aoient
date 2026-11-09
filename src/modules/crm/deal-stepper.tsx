"use client";
import { useOptimistic, useTransition } from "react";
import { Check, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { moveDealAction } from "./actions";

/** The pipeline as steps: click one to move the deal there. Won and lost sit at the end. */
export function DealStepper({ slug, dealId, title, stageId, stages, canMove }: {
  slug: string; dealId: string; title: string; stageId: string; canMove: boolean;
  stages: { id: string; name: string; kind: "open" | "won" | "lost" }[];
}) {
  const [current, setCurrent] = useOptimistic(stageId);
  const [pending, start] = useTransition();
  const open = stages.filter((s) => s.kind === "open");
  const closing = stages.filter((s) => s.kind !== "open");
  const cur = stages.find((s) => s.id === current);
  const reached = cur?.kind === "open" ? open.findIndex((s) => s.id === current) : cur?.kind === "won" ? open.length : -1;

  function go(s: (typeof stages)[number]) {
    if (!canMove || s.id === current || pending) return;
    start(async () => {
      setCurrent(s.id);
      const res = await moveDealAction(slug, dealId, { stageId: s.id });
      if (!res.ok) toast.error(res.error.message);
      else toast.success(s.kind === "won" ? `${title} won` : s.kind === "lost" ? `${title} marked as lost` : `Moved to ${s.name}`);
    });
  }

  return (
    <div className="grid gap-3">
      <ol className="flex flex-wrap gap-1.5" aria-label="Stage">
        {open.map((s, i) => {
          const done = i < reached, active = s.id === current;
          return (
            <li key={s.id} className="min-w-0 flex-1 basis-24">
              <button type="button" disabled={!canMove} onClick={() => go(s)} aria-current={active ? "step" : undefined}
                className={cn("flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all",
                  active ? "border-primary bg-primary text-primary-foreground shadow-sm" : done ? "border-primary/30 bg-surface-muted text-foreground" : "border-border text-muted-foreground",
                  canMove && !active && "hover:-translate-y-0.5 hover:border-primary/50 hover:text-foreground", !canMove && "cursor-default")}>
                {done ? <Check className="size-3.5 shrink-0" aria-hidden /> : <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full border border-current text-[9px]">{i + 1}</span>}
                <span className="truncate">{s.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {closing.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {closing.map((s) => {
            const active = s.id === current;
            return (
              <button key={s.id} type="button" disabled={!canMove} onClick={() => go(s)} aria-pressed={active}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  s.kind === "won" ? (active ? "border-success bg-success text-white" : "border-success/40 text-success hover:bg-success-subtle")
                    : (active ? "border-danger bg-danger text-white" : "border-danger/40 text-danger hover:bg-danger-subtle"), !canMove && "cursor-default")}>
                {s.kind === "won" ? <Trophy className="size-3.5" aria-hidden /> : <XCircle className="size-3.5" aria-hidden />}
                {active ? s.name : `Mark as ${s.name.toLowerCase()}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
