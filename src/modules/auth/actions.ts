"use server";
import { headers } from "next/headers";
import { clientKeyFrom, explainSignInFailure, type SignInFailureReason } from "@/server/auth/account-lookup";

/** Called only after a sign-in was refused, to explain why in plain words. */
export async function explainSignInFailureAction(email: string): Promise<SignInFailureReason> {
  return explainSignInFailure(String(email ?? ""), clientKeyFrom(await headers()));
}
