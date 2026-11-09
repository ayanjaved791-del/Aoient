"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import { CalendarDays, GripVertical, MoreHorizontal, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { money, shortDate } from "./labels";
import { moveDealAction } from "./actions";

export interface BoardStage { id: string; name: string; kind: "open" | "won" | "lost"; probability: number }
export interface BoardDeal {
  id: string; title: string; amount: number; currency: string; stageId: string; expectedCloseDate: string | null;
  company: string | null; contact: string | null; owner: string | null; overdue: boolean;
}

/**
 * The pipeline as columns. Drag a card to another column, or use its menu
 * (keyboard and touch friendly). The move shows at once and is confirmed by
 * the server, which checks the permission and the organization again.
 */
export function PipelineBoard({ slug, base, stages, deals, currency, canMove }: {
  slug: string; base: string; stages: BoardStage[]; deals: BoardDeal[]; currency: string; canMove: boolean;
}) {
  const [optimistic, applyMove] = useOptimistic(deals, (state, m: { id: string; stageId: string }) => state.map((d) => (d.id === m.id ? { ...d, stageId: m.stageId } : d)));
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function move(deal: BoardDeal, stage: BoardStage) {
    if (deal.stageId === stage.id) return;
    startTransition(async () => {
      applyMove({ id: deal.id, stageId: stage.id });
      const res = await moveDealAction(slug, deal.id, { stageId: stage.id });
      if (!res.ok) toast.error(res.error.message);
      else if (stage.kind === "won") toast.success(`${deal.title} won`, { description: "Nice work. It now counts toward this month's sales." });
      else if (stage.kind === "lost") toast(`${deal.title} marked as lost`);
      else toast.success(`Moved to ${stage.name}`);
    });
  }

  const onDrop = (stage: BoardStage) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/deal-id");
    const deal = optimistic.find((d) => d.id === id);
    setDragging(null); setOver(null);
    if (deal) move(deal, stage);
  };

  return (
    <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <ol className="flex min-w-max gap-3" aria-label="Pipeline">
        {stages.map((stage, si) => {
          const cards = optimistic.filter((d) => d.stageId === stage.id);
          const total = cards.filter((d) => d.currency === currency).reduce((a, d) => a + d.amount, 0);
          const isOver = over === stage.id && dragging !== null;
          return (
            <li key={stage.id} className="motion-safe:animate-rise w-[272px] shrink-0" style={{ animationDelay: `${si * 50}ms` }}>
              <section
                aria-label={`${stage.name}, ${cards.length} ${cards.length === 1 ? "deal" : "deals"}`}
                onDragOver={canMove ? (e) => { e.preventDefault(); setOver(stage.id); } : undefined}
                onDragLeave={canMove ? () => setOver((o) => (o === stage.id ? null : o)) : undefined}
                onDrop={canMove ? onDrop(stage) : undefined}
                className={cn("flex h-full min-h-72 flex-col rounded-xl border bg-surface-muted/50 p-2 transition-colors",
                  isOver ? "border-primary bg-surface-muted" : "border-border")}
              >
                <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                  <span className={cn("size-2 shrink-0 rounded-full", stage.kind === "won" ? "bg-success" : stage.kind === "lost" ? "bg-danger" : "bg-primary")} aria-hidden />
                  <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{stage.name}</h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground ring-1 ring-border">{cards.length}</span>
                </header>
                <p className="px-1.5 pb-2 text-xs text-muted-foreground">
                  {money(total, currency, true)}{stage.kind === "open" ? ` · ${stage.probability}% likely` : ""}
                </p>
                <ul className="grid flex-1 content-start gap-2">
                  {cards.map((d) => (
                    <li key={d.id}
                      draggable={canMove}
                      onDragStart={(e) => { e.dataTransfer.setData("text/deal-id", d.id); e.dataTransfer.effectAllowed = "move"; setDragging(d.id); }}
                      onDragEnd={() => { setDragging(null); setOver(null); }}
                      className={cn("group relative rounded-lg border border-border bg-surface p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
                        canMove && "cursor-grab active:cursor-grabbing", dragging === d.id && "opacity-40")}>
                      <div className="flex items-start gap-1.5">
                        {canMove && <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />}
                        <Link href={`${base}/deals/${d.id}`} className="min-w-0 flex-1 text-sm font-medium leading-snug hover:underline after:absolute after:inset-0">
                          {d.title}
                        </Link>
                        {canMove && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="relative z-10 -mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 hover:bg-surface-muted hover:text-foreground group-hover:opacity-100" aria-label={`Move ${d.title}`}>
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Move to</DropdownMenuLabel>
                              {stages.filter((s) => s.kind === "open").map((s) => (
                                <DropdownMenuItem key={s.id} disabled={s.id === d.stageId} onSelect={() => move(d, s)}>{s.name}</DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              {stages.filter((s) => s.kind !== "open").map((s) => (
                                <DropdownMenuItem key={s.id} disabled={s.id === d.stageId} onSelect={() => move(d, s)}>
                                  {s.kind === "won" ? <Trophy className="size-4 text-success" /> : <XCircle className="size-4 text-danger" />}{s.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      {(d.company || d.contact) && <p className="mt-1 truncate text-xs text-muted-foreground">{[d.company, d.contact].filter(Boolean).join(" · ")}</p>}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">{money(d.amount, d.currency)}</span>
                        {d.expectedCloseDate && (
                          <span className={cn("ml-auto inline-flex items-center gap-1 text-[11px]", d.overdue ? "font-medium text-danger" : "text-muted-foreground")} title={d.overdue ? "Expected close date has passed" : "Expected close"}>
                            <CalendarDays className="size-3" aria-hidden />{shortDate(d.expectedCloseDate).replace(/, \d{4}$/, "")}
                          </span>
                        )}
                        {d.owner && <Avatar name={d.owner} size="sm" className={cn("size-6 text-[10px]", !d.expectedCloseDate && "ml-auto")} />}
                      </div>
                    </li>
                  ))}
                  {cards.length === 0 && (
                    <li className={cn("rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground", isOver ? "border-primary" : "border-border")}>
                      {canMove ? "Drop a deal here" : "No deals"}
                    </li>
                  )}
                </ul>
              </section>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
