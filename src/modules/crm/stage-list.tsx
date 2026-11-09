"use client";
import { useOptimistic, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { StageDialog } from "./forms";
import { STAGE_KIND_LABELS } from "./labels";
import { deleteStageAction, reorderStagesAction } from "./actions";

export interface StageItem { id: string; name: string; kind: "open" | "won" | "lost"; probability: number; dealCount: number }

/** Pipeline stages in order, with move up/down, edit and delete. */
export function StageList({ slug, stages }: { slug: string; stages: StageItem[] }) {
  const [list, setList] = useOptimistic(stages);
  const [pending, start] = useTransition();
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    start(async () => {
      setList(next);
      const res = await reorderStagesAction(slug, { ids: next.map((s) => s.id) });
      if (!res.ok) toast.error(res.error.message);
    });
  }
  return (
    <ol className="divide-y divide-border">
      {list.map((s, i) => (
        <li key={s.id} className="flex items-center gap-3 px-4 py-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold tabular-nums">{i + 1}</span>
          <div className="grid min-w-0 flex-1">
            <span className="flex items-center gap-2 truncate font-medium">{s.name}
              <Badge tone={s.kind === "won" ? "success" : s.kind === "lost" ? "danger" : "neutral"}>{STAGE_KIND_LABELS[s.kind]}</Badge>
            </span>
            <span className="text-xs text-muted-foreground">{s.probability}% chance to win · {s.dealCount} {s.dealCount === 1 ? "deal" : "deals"}</span>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${s.name} up`} disabled={i === 0 || pending} onClick={() => move(i, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${s.name} down`} disabled={i === list.length - 1 || pending} onClick={() => move(i, 1)}><ArrowDown /></Button>
            <StageDialog slug={slug} stage={s} trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`}><Pencil /></Button>} />
            <ConfirmDialog
              trigger={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${s.name}`} className="text-muted-foreground hover:text-danger"><Trash2 /></Button>}
              title={`Delete ${s.name}?`}
              description={s.dealCount ? `${s.dealCount} ${s.dealCount === 1 ? "deal is" : "deals are"} in this stage. Move them to another stage first.` : "No deals are in this stage."}
              confirmLabel="Delete"
              onConfirm={async () => {
                const res = await deleteStageAction(slug, s.id);
                if (!res.ok) { toast.error(res.error.message); return false; }
                toast.success(`${s.name} deleted`);
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
