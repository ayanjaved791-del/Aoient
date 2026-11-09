/** Plain module (no "use client") so server pages and client components can both use these. */
export const PROJECT_STATUS_LABELS: Record<string, string> = { planning: "Planning", active: "Active", on_hold: "On hold", completed: "Completed", cancelled: "Cancelled" };
export const PROJECT_STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  planning: "neutral", active: "primary", on_hold: "warning", completed: "success", cancelled: "danger",
};
export const TASK_STATUS_LABELS: Record<string, string> = { todo: "To do", in_progress: "In progress", review: "Review", done: "Done" };
export const TASK_PRIORITY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
export const TASK_PRIORITY_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = { low: "neutral", medium: "neutral", high: "warning", urgent: "danger" };
export const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const fullDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
