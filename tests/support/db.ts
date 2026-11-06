import { randomUUID } from "node:crypto";
import { getDb } from "@/server/database/client";
import { syncPermissionCatalog } from "@/server/permissions/sync";
import { resolveOrgContext } from "@/server/tenancy/context";
import { createOrganization } from "@/server/organizations/organizations";

export const db = () => getDb();

/** Wipe all app data (and test auth users) and restore reference data. */
export async function resetDatabase() {
  const sql = getDb();
  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migration'`;
  await sql.unsafe(`truncate ${tables.map((t) => `public."${t.tablename}"`).join(", ")}, auth.users cascade`);
  await syncPermissionCatalog(sql);
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/** Creates a Supabase-style auth user; the migration's trigger creates the profile. */
export async function createUser(opts: { email?: string; name?: string; verified?: boolean } = {}): Promise<TestUser> {
  const sql = getDb();
  const email = (opts.email ?? `user-${randomUUID().slice(0, 8)}@example.test`).toLowerCase();
  const name = opts.name ?? email.split("@")[0];
  const verified = opts.verified ?? true;
  const [u] = await sql<{ id: string }[]>`
    insert into auth.users (email, raw_user_meta_data, email_confirmed_at)
    values (${email}, ${sql.json({ name })}, ${verified ? new Date() : null})
    returning id`;
  return { id: u.id, email, name, emailVerified: verified };
}

/** Creates an org with `owner` as Owner and returns the owner's verified context. */
export async function createOrgWithOwner(slug: string, owner?: TestUser) {
  const user = owner ?? (await createUser());
  const org = await createOrganization(user, { name: `Org ${slug}`, slug });
  const ctx = await resolveOrgContext(user.id, { id: org.id });
  return { org, user, ctx };
}

export async function systemRoleId(key: string): Promise<string> {
  const [role] = await getDb()<{ id: string }[]>`select id from role where organization_id is null and key = ${key}`;
  if (!role) throw new Error(`System role ${key} not found`);
  return role.id;
}

/** Directly add a member with a role (bypasses invitations — test setup only). */
export async function addMember(organizationId: string, roleKeyOrId: string, user?: TestUser) {
  const u = user ?? (await createUser());
  const roleId = roleKeyOrId.includes("-") && roleKeyOrId.length === 36 ? roleKeyOrId : await systemRoleId(roleKeyOrId);
  const [member] = await getDb()<{ id: string; organizationId: string; userId: string; roleId: string; status: string }[]>`
    insert into organization_member (organization_id, user_id, role_id) values (${organizationId}, ${u.id}, ${roleId})
    returning id, organization_id as "organizationId", user_id as "userId", role_id as "roleId", status`;
  const ctx = await resolveOrgContext(u.id, { id: organizationId });
  return { user: u, member, ctx };
}
