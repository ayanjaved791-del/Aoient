import { z } from "zod";
import { currencySchema } from "./organization";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use ${max} characters or fewer`).optional().nullable().transform((v) => (v ? v : null));
const optionalId = z.string().trim().optional().nullable().transform((v) => (v ? v : null));
const optionalEmail = z.string().trim().toLowerCase().max(254).optional().nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address");
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const date = z.string().trim().min(1, "Pick a date").refine(isDay, "Use a valid date");
const optionalDate = z.string().trim().optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || isDay(v), "Use a valid date");
const num = (label: string, opts: { min: number; max: number; positive?: boolean }) =>
  z.union([z.number(), z.string()])
    .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? Number.NaN : Number(v.replace(/,/g, ""))))
    .refine((v) => Number.isFinite(v), `Enter ${label}`)
    .refine((v) => (opts.positive ? v > opts.min : v >= opts.min) && v <= opts.max, `Enter ${label}`)
    // Stored with two decimals.
    .transform((v) => Math.round(v * 100) / 100);
const currency = z.string().optional().nullable().transform((v) => (v ? v.toUpperCase() : null)).pipe(currencySchema.nullable());

export const DOCUMENT_KINDS = ["invoice", "estimate"] as const;
export const PAYMENT_METHODS = ["bank_transfer", "cash", "card", "cheque", "online", "other"] as const;
export const EXPENSE_CATEGORIES = ["travel", "meals", "software", "equipment", "office", "marketing", "contractors", "utilities", "rent", "other"] as const;

export const lineSchema = z.object({
  description: z.string().trim().min(1, "Describe the item").max(300, "Use 300 characters or fewer"),
  quantity: num("a quantity above 0", { min: 0, max: 1_000_000, positive: true }),
  unitPrice: num("a valid price", { min: 0, max: 1e10 }),
  taxRate: num("a tax rate from 0 to 100", { min: 0, max: 100 }).optional().default(0),
});

export const documentSchema = z.object({
  billToName: z.string().trim().min(2, "Who is this for?").max(160, "Use 160 characters or fewer"),
  billToEmail: optionalEmail,
  billToAddress: optionalText(500),
  companyId: optionalId,
  projectId: optionalId,
  issueDate: date,
  dueDate: optionalDate,
  currency,
  notes: optionalText(2000),
  lines: z.array(lineSchema).min(1, "Add at least one item").max(100, "Use 100 items or fewer"),
}).refine((v) => !v.dueDate || v.dueDate >= v.issueDate, { path: ["dueDate"], message: "The due date can't be before the issue date" });

export const paymentSchema = z.object({
  amount: num("an amount above 0", { min: 0, max: 1e12, positive: true }),
  paidOn: date,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(120),
  notes: optionalText(500),
});

export const voidSchema = z.object({ reason: optionalText(300) });
export const estimateStatusSchema = z.object({ status: z.enum(["draft", "sent", "accepted", "declined"]) });

export const expenseSchema = z.object({
  description: z.string().trim().min(2, "Use at least 2 characters").max(200, "Use 200 characters or fewer"),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: num("an amount above 0", { min: 0, max: 1e12, positive: true }),
  currency,
  spentOn: date,
  vendorId: optionalId,
  projectId: optionalId,
  notes: optionalText(1000),
});

export const reviewExpenseSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: optionalText(300),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(120, "Use 120 characters or fewer"),
  email: optionalEmail,
  phone: optionalText(40),
  taxId: optionalText(60),
  notes: optionalText(1000),
});

/** Line and document totals in whole cents, so rounding never drifts. */
export function computeTotals(lines: { quantity: number; unitPrice: number; taxRate: number }[]) {
  let subtotal = 0, tax = 0;
  const amounts = lines.map((l) => {
    const amount = Math.round(l.quantity * Math.round(l.unitPrice * 100));
    subtotal += amount;
    tax += Math.round((amount * l.taxRate) / 100);
    return amount / 100;
  });
  return { amounts, subtotal: subtotal / 100, taxTotal: tax / 100, total: (subtotal + tax) / 100 };
}

export const TEMPLATE_LAYOUTS = ["classic", "modern", "compact"] as const;
const title = (fallback: string) => z.string().trim().max(40, "Use 40 characters or fewer").optional().nullable().transform((v) => v || fallback);

export const templateSchema = z.object({
  layout: z.enum(TEMPLATE_LAYOUTS).default("classic"),
  accent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour").default("#0a0a0a"),
  showLogo: z.boolean().default(true),
  businessName: optionalText(160),
  businessAddress: optionalText(500),
  businessEmail: optionalEmail,
  businessPhone: optionalText(40),
  taxId: optionalText(60),
  invoiceTitle: title("Invoice"),
  estimateTitle: title("Estimate"),
  receiptTitle: title("Payment receipt"),
  defaultNotes: optionalText(2000),
  footer: optionalText(300),
  defaultDueDays: z.union([z.number(), z.string()]).transform((v) => Number(v)).refine((v) => Number.isInteger(v) && v >= 0 && v <= 365, "Use 0 to 365 days"),
  defaultTaxRate: num("a tax rate from 0 to 100", { min: 0, max: 100 }),
});
