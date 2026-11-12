import { z } from "zod";

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
export const daySchema = z.string().trim().min(1, "Pick a date").refine(isDay, "Use a valid date");
const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const optionalTime = z.string().trim().optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || isTime(v), "Use a time like 09:30");

export const ATTENDANCE_STATUSES = ["present", "half_day", "absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** A manager's correction of one person's day. Times are in the workspace's time zone. */
export const correctionSchema = z.object({
  employeeId: z.string().trim().min(1, "Pick a person"),
  workDate: daySchema,
  status: z.enum(ATTENDANCE_STATUSES),
  checkIn: optionalTime,
  checkOut: optionalTime,
  note: z.string().trim().max(300, "Use 300 characters or fewer").optional().nullable().transform((v) => (v ? v : null)),
}).superRefine((v, c) => {
  if (v.status === "absent") return;
  if (!v.checkIn) c.addIssue({ code: "custom", path: ["checkIn"], message: "Enter when they started" });
  if (v.checkIn && v.checkOut && v.checkOut <= v.checkIn) c.addIssue({ code: "custom", path: ["checkOut"], message: "Must be after the start time" });
});

export const attendanceSettingSchema = z.object({
  workStarts: z.string().trim().refine(isTime, "Use a time like 09:00"),
  graceMinutes: z.union([z.number(), z.string()]).transform((v) => Number(v)).refine((v) => Number.isInteger(v) && v >= 0 && v <= 240, "Use 0 to 240 minutes"),
});

export const checkSchema = z.object({ note: z.string().trim().max(300, "Use 300 characters or fewer").optional().nullable().transform((v) => (v ? v : null)) });

/** "2026-11" → first and last day. */
export function monthRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Mon–Fri days between two dates (inclusive). */
export function weekdaysBetween(from: string, to: string): number {
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}
