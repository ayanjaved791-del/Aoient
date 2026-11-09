"use server";
import { headers } from "next/headers";
import { clientKeyFrom, explainSignInFailure, type SignInFailureReason } from "@/server/auth/account-lookup";
import { signUpWithoutEmail } from "@/server/auth/self-signup";
import { getSupabaseServerClient } from "@/server/auth/supabase";
import { runAction } from "@/server/actions/run";

/** Called only after a sign-in was refused, to explain why in plain words. */
export async function explainSignInFailureAction(email: string): Promise<SignInFailureReason> {
  return explainSignInFailure(String(email ?? ""), clientKeyFrom(await headers()));
}

/**
 * The browser's Supabase sign-up was refused because the confirmation email
 * couldn't be sent: create the account on the server and sign it in.
 */
export async function signUpWithoutEmailAction(input: unknown, captchaToken?: string) {
  return runAction(async () => {
    const { tokenHash } = await signUpWithoutEmail(input, { clientKey: clientKeyFrom(await headers()), captchaToken });
    const supabase = await getSupabaseServerClient();
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    // The account exists either way; if the automatic sign-in failed they can sign in normally.
    return { signedIn: !error };
  });
}
