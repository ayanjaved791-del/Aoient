import "server-only";
import { randomBytes } from "node:crypto";
import { getDb } from "@/server/database/client";
import { setAuthUserPassword, type AdminOptions } from "@/server/auth/admin";

/**
 * Called after someone proves they own an account's email another way (for
 * example "Continue with Google"). If the account still has a temporary
 * password that an admin chose, that password is replaced with a random one
 * nobody knows, so whoever set it can no longer sign in as this person.
 * Returns false only when the password couldn't be replaced.
 */
export async function revokeTemporaryPassword(userId: string, admin: AdminOptions = {}): Promise<boolean> {
  const [row] = await getDb()<{ must_change_password: boolean; managed: boolean }[]>`
    select must_change_password, managed_by_organization_id is not null as managed from profile where id = ${userId}`;
  if (!row?.must_change_password || !row.managed) return true;
  try {
    await setAuthUserPassword(userId, randomBytes(32).toString("base64url"), admin);
  } catch (e) {
    console.error("[auth] couldn't replace a temporary password", e);
    return false;
  }
  await getDb()`update profile set must_change_password = false, updated_at = now() where id = ${userId}`;
  return true;
}
