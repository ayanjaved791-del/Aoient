import { z } from "zod";

const email = z.string().trim().toLowerCase().min(1, "Enter your email").pipe(z.email("Enter a valid email address"));
const newPassword = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use 128 characters or fewer");

export const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password") });
export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(80),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/**
 * Only allow same-site relative redirects. Blocks //evil.com and its disguises:
 * browsers drop tabs and newlines and read "\\" as "/", so "/\t/evil.com" or
 * "/\\evil.com" would otherwise leave the site.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/pricing"): string {
  if (!next || next.length > 2048 || !next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  const base = "https://aoient.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
