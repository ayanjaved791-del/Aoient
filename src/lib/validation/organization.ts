import { z } from "zod";

export const RESERVED_SLUGS = new Set([
  "api", "app", "admin", "auth", "sign-in", "sign-up", "sign-out", "verify-email", "forgot-password",
  "reset-password", "invite", "invitations", "onboarding", "organizations", "settings", "billing",
  "account", "static", "_next", "public", "help", "support", "docs", "status", "www", "aoient",
  // Public site pages and app routes that would otherwise hide a workspace with the same URL.
  "features", "modules", "security", "pricing", "faq", "checkout", "home", "about", "contact", "blog", "legal", "privacy", "terms",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(48, "Use 48 characters or fewer")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens")
  .refine((s) => !RESERVED_SLUGS.has(s), "This URL is reserved");

/** Validated against the runtime's IANA zone list. */
export const timezoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Choose a valid time zone");

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a 3-letter ISO currency code");

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(80, "Use 80 characters or fewer"),
  slug: slugSchema,
  timezone: timezoneSchema.default("UTC"),
  currency: currencySchema.default("USD"),
});
export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;

// Explicit (not `.partial()` of the create schema) so create-time defaults can
// never be applied to fields omitted from a PATCH.
export const updateOrganizationSchema = z.object({
  name: createOrganizationSchema.shape.name.optional(),
  slug: slugSchema.optional(),
  timezone: timezoneSchema.optional(),
  currency: currencySchema.optional(),
});
export type UpdateOrganizationInput = z.input<typeof updateOrganizationSchema>;

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, "Email is too long").pipe(z.email("Enter a valid email address")),
  roleId: z.uuid("Choose a role"),
});
export type CreateInvitationInput = z.input<typeof createInvitationSchema>;

export const updateMemberSchema = z
  .object({
    roleId: z.uuid().optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .refine((v) => v.roleId !== undefined || v.status !== undefined, "Nothing to update");
export type UpdateMemberInput = z.input<typeof updateMemberSchema>;

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(60, "Use 60 characters or fewer"),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  permissions: z.array(z.string()).max(200),
});
export type RoleInput = z.input<typeof roleSchema>;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
