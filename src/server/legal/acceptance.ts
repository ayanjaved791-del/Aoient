import "server-only";
import { getDb, type Db } from "@/server/database/client";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { ValidationError } from "@/lib/errors";

export type AcceptanceContext = "workspace" | "checkout";

/** Has this person agreed to the current Terms and Privacy Policy before (in any context)? */
export async function hasAcceptedCurrentTerms(userId: string, q: Db = getDb()): Promise<boolean> {
  const [row] = await q`
    select 1 from legal_acceptance
    where user_id = ${userId} and terms_version = ${TERMS_VERSION} and privacy_version = ${PRIVACY_VERSION}
    limit 1`;
  return Boolean(row);
}

export async function recordAcceptance(
  q: Db,
  a: { userId: string; organizationId: string | null; context: AcceptanceContext },
): Promise<void> {
  await q`
    insert into legal_acceptance (user_id, organization_id, context, terms_version, privacy_version)
    values (${a.userId}, ${a.organizationId}, ${a.context}, ${TERMS_VERSION}, ${PRIVACY_VERSION})`;
}

/** The request must carry `acceptTerms: true` unless the person already agreed to the current versions. */
export async function assertTermsAccepted(userId: string, input: unknown): Promise<void> {
  const accepted = typeof input === "object" && input !== null && (input as { acceptTerms?: unknown }).acceptTerms === true;
  if (accepted || (await hasAcceptedCurrentTerms(userId))) return;
  throw new ValidationError("Please agree to the Terms of Service and Privacy Policy to continue.", {
    acceptTerms: ["Please agree to the Terms of Service and Privacy Policy to continue."],
  });
}
