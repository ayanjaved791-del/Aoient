"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

let client: SupabaseClient | undefined;

/**
 * Browser Supabase client — used ONLY for Supabase Auth (sign-up, sign-in,
 * password reset). It never reads app tables: those are behind Row Level
 * Security with no browser access, and all data goes through our server.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
