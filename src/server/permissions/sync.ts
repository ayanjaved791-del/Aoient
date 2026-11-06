/**
 * Mirrors the code-defined permission catalogue and system roles into the
 * database. Idempotent; safe to run on every deploy (via `npm run db:seed`).
 * Takes the client as an argument so the seed script and tests can reuse it.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { PERMISSIONS, SYSTEM_ROLES, SYSTEM_ROLE_KEYS } from "./catalog";

export async function syncPermissionCatalog(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const p of PERMISSIONS) {
      await tx.permission.upsert({
        where: { key: p.key },
        create: { key: p.key, description: p.description, module: p.module },
        update: { description: p.description, module: p.module },
      });
    }
    // Permissions removed from the catalogue are deleted (cascades their grants).
    await tx.permission.deleteMany({ where: { key: { notIn: PERMISSIONS.map((p) => p.key) } } });

    const permissionRows = await tx.permission.findMany({ select: { id: true, key: true } });
    const idByKey = new Map(permissionRows.map((r) => [r.key, r.id]));

    for (const key of SYSTEM_ROLE_KEYS) {
      const def = SYSTEM_ROLES[key];
      const existing = await tx.role.findFirst({ where: { organizationId: null, key } });
      const role = existing
        ? await tx.role.update({ where: { id: existing.id }, data: { name: def.name, description: def.description, isSystem: true } })
        : await tx.role.create({ data: { key, name: def.name, description: def.description, isSystem: true } });

      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: def.permissions.map((k) => ({ roleId: role.id, permissionId: idByKey.get(k)! })),
      });
    }
  });
}
