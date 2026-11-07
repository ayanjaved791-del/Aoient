import { z } from "zod";
import { currencySchema } from "./organization";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use ${max} characters or fewer`).optional().nullable().transform((v) => (v ? v : null));
const optionalDate = z
  .string().trim().optional().nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "Use a valid date");
const optionalId = z.string().trim().optional().nullable().transform((v) => (v ? v : null));

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern"] as const;
export const SALARY_PERIODS = ["hourly", "monthly", "yearly"] as const;
export const LEAVE_TYPES = ["annual", "sick", "unpaid", "other"] as const;

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(60, "Use 60 characters or fewer"),
  description: optionalText(240),
  headEmployeeId: optionalId,
});

/** Work details anyone with people.employee.update may set. */
export const employeeBasicSchema = z.object({
  fullName: z.string().trim().min(2, "Use at least 2 characters").max(120, "Use 120 characters or fewer"),
  workEmail: z.string().trim().toLowerCase().max(254).optional().nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address"),
  phone: optionalText(40),
  jobTitle: optionalText(80),
  employeeCode: optionalText(32),
  departmentId: optionalId,
  managerId: optionalId,
  memberId: optionalId,
  employmentType: z.enum(EMPLOYMENT_TYPES).default("full_time"),
  location: optionalText(80),
  startDate: optionalDate,
});

/** Private details: need people.employee.sensitive.read to see or set. */
export const employeeSensitiveSchema = z.object({
  dateOfBirth: optionalDate,
  personalEmail: z.string().trim().toLowerCase().max(254).optional().nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address"),
  homeAddress: optionalText(240),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(40),
  salaryAmount: z.union([z.number(), z.string()]).optional().nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e12), "Enter a valid amount"),
  salaryCurrency: z.string().optional().nullable().transform((v) => (v ? v : null)).pipe(currencySchema.nullable()),
  salaryPeriod: z.enum(SALARY_PERIODS).optional().nullable().transform((v) => v ?? null),
});

export const leaveRequestSchema = z.object({
  type: z.enum(LEAVE_TYPES),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date"),
  halfDay: z.boolean().optional().default(false),
  reason: optionalText(500),
}).refine((v) => v.endDate >= v.startDate, { message: "The end date can't be before the start date", path: ["endDate"] })
  .refine((v) => !v.halfDay || v.startDate === v.endDate, { message: "A half day must start and end on the same date", path: ["halfDay"] });

export const leaveDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: optionalText(500),
});

/** Working days (Mon–Fri) between two ISO dates, inclusive. */
export function workingDays(start: string, end: string): number {
  let n = 0;
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  for (; d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}
