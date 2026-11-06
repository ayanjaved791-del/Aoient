import { randomUUID } from "node:crypto";
import { db } from "@/server/database/client";
import { syncPermissionCatalog } from "@/server/permissions/sync";
import { resolveOrgContext } from "@/server/tenancy/context";
import { createOrganization } from "@/server/organizations/organizations";

export { db };

/** Wipe all tables and restore reference data. */
export async function resetDatabase() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await syncPermissionCatalog(db);
}

export async function createUser(opts: { email?: string; name?: string; verified?: boolean } = {}) {
  const email = opts.email ?? `user-${randomUUID().slice(0, 8)}@example.test`;
  return db.user.create({
    data: { email, name: opts.name ?? email.split("@")[0], emailVerified: opts.verified ?? true },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
}

/** Creates an org with `owner` as Owner and returns the owner's verified context. */
export async function createOrgWithOwner(slug: string, owner?: Awaited<ReturnType<typeof createUser>>) {
  const user = owner ?? (await createUser());
  const org = await createOrganization(user, { name: `Org ${slug}`, slug });
  const ctx = await resolveOrgContext(user.id, { id: org.id });
  return { org, user, ctx };
}

export async function systemRoleId(key: string) {
  const role = await db.role.findFirstOrThrow({ where: { organizationId: null, key } });
  return role.id;
}

/** Directly add a member with a role (bypasses invitations — test setup only). */
export async function addMember(organizationId: string, roleKeyOrId: string, user?: Awaited<ReturnType<typeof createUser>>) {
  const u = user ?? (await createUser());
  const roleId = roleKeyOrId.includes("-") && roleKeyOrId.length === 36 ? roleKeyOrId : await systemRoleId(roleKeyOrId);
  const member = await db.organizationMember.create({ data: { organizationId, userId: u.id, roleId } });
  const ctx = await resolveOrgContext(u.id, { id: organizationId });
  return { user: u, member, ctx };
}
