/**
 * Public Supabase settings (safe in the browser). Referenced literally so Next
 * inlines them at build time. The publishable key replaced the legacy "anon"
 * key; either works.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/** Names of missing public settings, for honest "not connected" messages. */
export function missingSupabaseConfig(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_PUBLISHABLE_KEY) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return missing;
}

/**
 * "Continue with Google" is shown only once the Google provider has been set up
 * in Supabase (Authentication → Sign In / Providers → Google) and this flag is
 * "true", so the button never appears before it can work.
 */
export const isGoogleAuthEnabled = isSupabaseConfigured && process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";
