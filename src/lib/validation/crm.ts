import { z } from "zod";
import { currencySchema } from "./organization";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use ${max} characters or fewer`).optional().nullable().transform((v) => (v ? v : null));
const optionalId = z.string().trim().optional().nullable().transform((v) => (v ? v : null));
const optionalEmail = z.string().trim().toLowerCase().max(254).optional().nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address");
const optionalDate = z.string().trim().optional().nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "Use a valid date");
const money = z.union([z.number(), z.string()]).optional().nullable()
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(/,/g, ""))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e12), "Enter a valid amount");
const name = (min = 2, max = 120) => z.string().trim().min(min, `Use at least ${min} characters`).max(max, `Use ${max} characters or fewer`);

export const LEAD_SOURCES = ["website", "referral", "event", "social", "outbound", "other"] as const;
export const LEAD_STATUSES = ["new", "contacted", "qualified", "disqualified"] as const;
export const STAGE_KINDS = ["open", "won", "lost"] as const;
export const NOTE_SUBJECTS = ["lead", "contact", "company", "deal"] as const;

export const companySchema = z.object({
  name: name(2, 120),
  website: optionalText(200),
  industry: optionalText(80),
  phone: optionalText(40),
  city: optionalText(80),
  ownerMemberId: optionalId,
});

export const contactSchema = z.object({
  fullName: name(2, 120),
  email: optionalEmail,
  phone: optionalText(40),
  jobTitle: optionalText(80),
  companyId: optionalId,
  ownerMemberId: optionalId,
});

export const leadSchema = z.object({
  fullName: name(2, 120),
  email: optionalEmail,
  phone: optionalText(40),
  companyName: optionalText(120),
  source: z.enum(LEAD_SOURCES).default("other"),
  status: z.enum(LEAD_STATUSES).default("new"),
  estimatedValue: money,
  ownerMemberId: optionalId,
});

export const dealSchema = z.object({
  title: name(2, 140),
  stageId: optionalId,
  companyId: optionalId,
  contactId: optionalId,
  amount: money.transform((v) => v ?? 0),
  currency: z.string().optional().nullable().transform((v) => (v ? v.toUpperCase() : null)).pipe(currencySchema.nullable()),
  expectedCloseDate: optionalDate,
  ownerMemberId: optionalId,
});

export const moveDealSchema = z.object({
  stageId: z.string().trim().min(1, "Pick a stage"),
  lostReason: optionalText(240),
});

export const convertLeadSchema = z.object({
  createDeal: z.boolean().default(true),
  dealTitle: optionalText(140),
  amount: money,
});

export const stageSchema = z.object({
  name: name(2, 40),
  kind: z.enum(STAGE_KINDS).default("open"),
  probability: z.union([z.number(), z.string()]).optional().nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 100), "Use a whole number from 0 to 100"),
});

export const stageOrderSchema = z.object({ ids: z.array(z.string()).min(1).max(30) });

export const noteSchema = z.object({
  subjectType: z.enum(NOTE_SUBJECTS),
  subjectId: z.string().trim().min(1),
  body: z.string().trim().min(1, "Write something first").max(4000, "Use 4000 characters or fewer"),
});
