import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use ${max} characters or fewer`).optional().nullable().transform((v) => (v ? v : null));
const optionalId = z.string().trim().optional().nullable().transform((v) => (v ? v : null));
const optionalDate = z.string().trim().optional().nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "Use a valid date");
const name = (min: number, max: number) => z.string().trim().min(min, `Use at least ${min} characters`).max(max, `Use ${max} characters or fewer`);

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const projectSchema = z.object({
  name: name(2, 100),
  description: optionalText(2000),
  status: z.enum(PROJECT_STATUSES).default("active"),
  companyId: optionalId,
  dealId: optionalId,
  ownerMemberId: optionalId,
  startDate: optionalDate,
  dueDate: optionalDate,
  memberIds: z.array(z.string()).max(100).optional().default([]),
}).refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, { message: "The due date can't be before the start date", path: ["dueDate"] });

export const milestoneSchema = z.object({ name: name(2, 100), dueDate: optionalDate });

export const taskSchema = z.object({
  title: name(2, 200),
  description: optionalText(4000),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assigneeMemberId: optionalId,
  milestoneId: optionalId,
  dueDate: optionalDate,
});

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  /** Ids of the cards around the drop point, to order the task between them. */
  beforeId: optionalId,
  afterId: optionalId,
});

export const commentSchema = z.object({ body: z.string().trim().min(1, "Write something first").max(4000, "Use 4000 characters or fewer") });
