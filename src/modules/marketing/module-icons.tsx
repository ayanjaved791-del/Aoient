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
export const MODULE_STYLE: Record<ModuleKey, { name: string; icon: LucideIcon; gradient: string; glow: string; text: string }> = {
  organization: { name: "Organization & access", icon: Building2, gradient: "from-neutral-700 to-black dark:from-neutral-200 dark:to-white", glow: "shadow-neutral-900/30", text: "text-neutral-900 dark:text-white" },
  people: { name: "People", icon: Users, gradient: "from-sky-400 to-blue-600", glow: "shadow-blue-500/40", text: "text-blue-600 dark:text-sky-400" },
  crm: { name: "CRM", icon: Handshake, gradient: "from-orange-400 to-rose-500", glow: "shadow-rose-500/40", text: "text-rose-600 dark:text-orange-400" },
  projects: { name: "Projects", icon: FolderKanban, gradient: "from-violet-400 to-purple-600", glow: "shadow-purple-500/40", text: "text-purple-600 dark:text-violet-400" },
  time: { name: "Time", icon: Clock3, gradient: "from-amber-300 to-orange-500", glow: "shadow-amber-500/40", text: "text-amber-600 dark:text-amber-300" },
  finance: { name: "Finance", icon: Receipt, gradient: "from-emerald-400 to-green-600", glow: "shadow-emerald-500/40", text: "text-emerald-600 dark:text-emerald-400" },
  flow: { name: "Flow", icon: Workflow, gradient: "from-fuchsia-400 to-pink-600", glow: "shadow-pink-500/40", text: "text-pink-600 dark:text-fuchsia-400" },
  analytics: { name: "Analytics", icon: ChartNoAxesCombined, gradient: "from-cyan-400 to-teal-600", glow: "shadow-teal-500/40", text: "text-teal-600 dark:text-cyan-400" },
  documents: { name: "Documents", icon: FileText, gradient: "from-indigo-400 to-blue-700", glow: "shadow-indigo-500/40", text: "text-indigo-600 dark:text-indigo-400" },
  inventory: { name: "Inventory", icon: Boxes, gradient: "from-lime-400 to-green-600", glow: "shadow-lime-500/40", text: "text-lime-700 dark:text-lime-400" },
  workspace: { name: "Workspace", icon: LayoutGrid, gradient: "from-yellow-300 to-amber-500", glow: "shadow-yellow-500/40", text: "text-amber-600 dark:text-yellow-300" },
  connect: { name: "Connect", icon: Plug, gradient: "from-red-400 to-red-600", glow: "shadow-red-500/40", text: "text-red-600 dark:text-red-400" },
};

const SIZES = {
  xs: { box: "size-6 rounded-md", icon: "size-3.5" },
  sm: { box: "size-8 rounded-lg", icon: "size-4" },
  md: { box: "size-11 rounded-xl", icon: "size-5" },
  lg: { box: "size-14 rounded-2xl", icon: "size-6" },
} as const;

/** A glossy, colourful app-style icon for a module. */
export function ModuleIcon({ module, size = "md", className }: { module: ModuleKey; size?: keyof typeof SIZES; className?: string }) {
  const s = MODULE_STYLE[module];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25",
        module === "organization" && "dark:text-black",
        s.gradient,
        s.glow,
        SIZES[size].box,
        className,
      )}
      aria-hidden
    >
      <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
      <Icon className={cn("relative drop-shadow-sm", SIZES[size].icon)} strokeWidth={2.25} />
    </span>
  );
}
