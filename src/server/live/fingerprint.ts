import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/server/database/client";
import type { OrgContext } from "@/server/tenancy/context";

/**
 * A short fingerprint of everything in this organization that a page can show.
 * It changes whenever a record is added, edited or removed (last-updated time
 * plus row count per table), so open pages can refresh themselves only when
 * something actually changed. Reads this organization's rows only; the result
 * is a hash, so it reveals nothing about the data itself.
 */
export async function getLiveFingerprint(ctx: OrgContext): Promise<string> {
  const org = ctx.organizationId;
  const [row] = await getDb()<{ v: string }[]>`
    select concat_ws('|',
      (select updated_at from organization where id = ${org}),
      (select max(created_at) from audit_log where organization_id = ${org}),
      (select concat(max(updated_at), ':', count(*)) from organization_member where organization_id = ${org}),
      (select concat(max(updated_at), ':', count(*)) from invitation where organization_id = ${org}),
      (select concat(max(updated_at), ':', count(*)) from role where organization_id = ${org} or organization_id is null),
      (select max(updated_at) from organization_license where organization_id = ${org}),
      (select concat(max(updated_at), ':', count(*)) from department where organization_id = ${org}),
      (select concat(max(updated_at), ':', count(*)) from employee where organization_id = ${org}),
      (select concat(max(updated_at), ':', count(*)) from leave_request where organization_id = ${org}),
      (select updated_at from profile where id = ${ctx.userId})
    ) as v`;
  return createHash("sha256").update(row.v).digest("base64url").slice(0, 22);
}

/** Identifies the deployed version, so open tabs pick up a new release by themselves. */
export function buildVersion(): string {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev";
}
