import { z } from "zod";

const optionalId = z.string().trim().optional().nullable().transform((v) => (v ? v : null));
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const day = z.string().trim().min(1, "Pick a date").refine(isDay, "Use a valid date");
const optionalDay = z.string().trim().optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || isDay(v), "Use a valid date");

/**
 * "1:30", "1h 30m", "1.5", "1.5h", "90m", "90 min" → minutes. A bare number
 * means hours. Returns null for anything else.
 */
export function parseDuration(input: string | number): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 60) : null;
  const s = input.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  let m = s.match(/^(\d{1,2}):([0-5]\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(?:(\d{1,2})\s*m(?:in(?:utes?)?)?)?$/);
  if (m) return Math.round(Number(m[1]) * 60) + Number(m[2] ?? 0);
  m = s.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/);
  if (m) return Number(m[1]);
  m = s.match(/^\d+(?:\.\d+)?$/);
  if (m) return Math.round(Number(s) * 60);
  return null;
}

/** 95 → "1:35" */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** The Monday of the week a day falls in. */
export function weekStartOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const duration = z.union([z.string(), z.number()])
  .transform((v) => parseDuration(v))
  .refine((v): v is number => v !== null, "Use a time like 1:30, 1.5 or 90m")
  .refine((v) => v! >= 1 && v! <= 1440, "Between 1 minute and 24 hours");

export const entrySchema = z.object({
  workDate: day,
  duration,
  projectId: optionalId,
  taskId: optionalId,
  description: z.string().trim().max(300, "Use 300 characters or fewer").optional().nullable().transform((v) => (v ? v : null)),
  billable: z.boolean().default(false),
});

export const timerSchema = z.object({
  projectId: optionalId,
  taskId: optionalId,
  description: z.string().trim().max(300, "Use 300 characters or fewer").optional().nullable().transform((v) => (v ? v : null)),
  billable: z.boolean().default(false),
});

export const weekSchema = z.object({ weekStart: day.refine((v) => weekStartOf(v) === v, "Pick a Monday") });

export const reviewTimesheetSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300, "Use 300 characters or fewer").optional().nullable().transform((v) => (v ? v : null)),
});

export const billHoursSchema = z.object({
  projectId: z.string().trim().min(1, "Pick a project"),
  rate: z.union([z.number(), z.string()]).transform((v) => (typeof v === "number" ? v : Number(v.replace(/,/g, ""))))
    .refine((v) => Number.isFinite(v) && v > 0 && v < 1e7, "Enter an hourly rate above 0").transform((v) => Math.round(v * 100) / 100),
  from: optionalDay,
  to: optionalDay,
  groupBy: z.enum(["person", "task"]).default("person"),
});
