import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use ${max} characters or fewer`).optional().nullable().transform((v) => (v ? v : null));
const id = (msg: string) => z.string().trim().min(1, msg);
const num = (label: string, opts: { min: number; max: number; positive?: boolean }) =>
  z.union([z.number(), z.string()])
    .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? Number.NaN : Number(v.replace(/,/g, ""))))
    .refine((v) => Number.isFinite(v), `Enter ${label}`)
    .refine((v) => (opts.positive ? v > opts.min : v >= opts.min) && v <= opts.max, `Enter ${label}`)
    .transform((v) => Math.round(v * 100) / 100);
const optionalNum = (label: string, max: number) =>
  z.union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => (v === null || v === undefined || (typeof v === "string" && v.trim() === "") ? null : v))
    .pipe(z.union([z.null(), num(label, { min: 0, max })])).optional().transform((v) => v ?? null);

export const UNITS = ["pcs", "box", "kg", "g", "l", "ml", "m", "pack", "set", "hour"] as const;

export const productSchema = z.object({
  sku: z.string().trim().min(1, "Give it a SKU or code").max(40, "Use 40 characters or fewer")
    .regex(/^[A-Za-z0-9._\-/]+$/, "Use letters, numbers, dots, dashes or slashes"),
  name: z.string().trim().min(2, "Use at least 2 characters").max(160, "Use 160 characters or fewer"),
  description: optionalText(1000),
  unit: z.enum(UNITS).optional().default("pcs"),
  costPrice: num("a cost of 0 or more", { min: 0, max: 1e10 }).optional().default(0),
  salePrice: num("a price of 0 or more", { min: 0, max: 1e10 }).optional().default(0),
  reorderLevel: num("a reorder level of 0 or more", { min: 0, max: 1e9 }).optional().default(0),
});

export const locationSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(80, "Use 80 characters or fewer"),
  address: optionalText(300),
});

/** Stock in (receive), stock out (issue), or a count that sets the quantity on hand. */
export const movementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("receive"), productId: id("Pick a product"), locationId: id("Pick a location"), quantity: num("a quantity above 0", { min: 0, max: 1e9, positive: true }), unitCost: optionalNum("a cost of 0 or more", 1e10), reference: optionalText(80), note: optionalText(300) }),
  z.object({ kind: z.literal("issue"), productId: id("Pick a product"), locationId: id("Pick a location"), quantity: num("a quantity above 0", { min: 0, max: 1e9, positive: true }), reference: optionalText(80), note: optionalText(300) }),
  z.object({ kind: z.literal("count"), productId: id("Pick a product"), locationId: id("Pick a location"), counted: num("the counted quantity (0 or more)", { min: 0, max: 1e9 }), reference: optionalText(80), note: optionalText(300) }),
]);

export const transferSchema = z.object({
  productId: id("Pick a product"),
  fromLocationId: id("Pick where it leaves"),
  toLocationId: id("Pick where it goes"),
  quantity: num("a quantity above 0", { min: 0, max: 1e9, positive: true }),
  note: optionalText(300),
}).refine((v) => v.fromLocationId !== v.toLocationId, { path: ["toLocationId"], message: "Pick a different location" });
