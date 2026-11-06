import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Building2,
  ChartNoAxesCombined,
  Clock3,
  FileText,
  FolderKanban,
  Handshake,
  LayoutGrid,
  Plug,
  Receipt,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ModuleKey =
  | "organization" | "people" | "crm" | "projects" | "time" | "finance"
  | "flow" | "analytics" | "documents" | "inventory" | "workspace" | "connect";

/** Each module has its own colour so it's recognisable across the product. Class strings are literal for Tailwind. */
export const MODULE_STYLE: Record<ModuleKey, { name: string; icon: LucideIcon; tint: string; text: string }> = {
  organization: { name: "Organization & access", icon: Building2, tint: "bg-neutral-900/5 ring-neutral-900/10 dark:bg-white/10 dark:ring-white/15", text: "text-neutral-900 dark:text-white" },
  people: { name: "People", icon: Users, tint: "bg-blue-500/10 ring-blue-500/20", text: "text-blue-600 dark:text-sky-400" },
  crm: { name: "CRM", icon: Handshake, tint: "bg-rose-500/10 ring-rose-500/20", text: "text-rose-600 dark:text-orange-400" },
  projects: { name: "Projects", icon: FolderKanban, tint: "bg-purple-500/10 ring-purple-500/20", text: "text-purple-600 dark:text-violet-400" },
  time: { name: "Time", icon: Clock3, tint: "bg-amber-500/10 ring-amber-500/25", text: "text-amber-600 dark:text-amber-300" },
  finance: { name: "Finance", icon: Receipt, tint: "bg-emerald-500/10 ring-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
  flow: { name: "Flow", icon: Workflow, tint: "bg-pink-500/10 ring-pink-500/20", text: "text-pink-600 dark:text-fuchsia-400" },
  analytics: { name: "Analytics", icon: ChartNoAxesCombined, tint: "bg-teal-500/10 ring-teal-500/20", text: "text-teal-600 dark:text-cyan-400" },
  documents: { name: "Documents", icon: FileText, tint: "bg-indigo-500/10 ring-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400" },
  inventory: { name: "Inventory", icon: Boxes, tint: "bg-lime-500/10 ring-lime-600/25", text: "text-lime-700 dark:text-lime-400" },
  workspace: { name: "Workspace", icon: LayoutGrid, tint: "bg-yellow-400/15 ring-yellow-500/25", text: "text-amber-600 dark:text-yellow-300" },
  connect: { name: "Connect", icon: Plug, tint: "bg-red-500/10 ring-red-500/20", text: "text-red-600 dark:text-red-400" },
};

const SIZES = {
  xs: { box: "size-6 rounded-md", icon: "size-3.5" },
  sm: { box: "size-8 rounded-lg", icon: "size-4" },
  md: { box: "size-11 rounded-xl", icon: "size-5" },
  lg: { box: "size-14 rounded-2xl", icon: "size-6" },
} as const;

/** A clean module icon: the module's colour as a soft tint with a line icon. */
export function ModuleIcon({ module, size = "md", className }: { module: ModuleKey; size?: keyof typeof SIZES; className?: string }) {
  const s = MODULE_STYLE[module];
  const Icon = s.icon;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center ring-1 ring-inset", s.tint, s.text, SIZES[size].box, className)}
      aria-hidden
    >
      <Icon className={SIZES[size].icon} strokeWidth={1.75} />
    </span>
  );
}
