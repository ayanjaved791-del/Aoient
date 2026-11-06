/**
 * Mirrors the code-defined permission catalogue and system roles into the
 * database. Idempotent; safe to run on every deploy (via `npm run db:seed`).
 * Takes the connection as an argument so the seed script and tests can reuse it.
 */
import type postgres from "postgres";
import { PERMISSIONS, SYSTEM_ROLES, SYSTEM_ROLE_KEYS } from "./catalog";

export async function syncPermissionCatalog(sql: postgres.Sql): Promise<void> {
  await sql.begin(async (tx) => {
    for (const p of PERMISSIONS) {
      await tx`
        insert into permission (key, description, module) values (${p.key}, ${p.description}, ${p.module})
        on conflict (key) do update set description = excluded.description, module = excluded.module`;
    }
    // Permissions removed from the catalogue are deleted (cascades their grants).
    await tx`delete from permission where key <> all(${PERMISSIONS.map((p) => p.key)}::text[])`;

    for (const key of SYSTEM_ROLE_KEYS) {
      const def = SYSTEM_ROLES[key];
      const [existing] = await tx<{ id: string }[]>`select id from role where organization_id is null and key = ${key}`;
      const [role] = existing
        ? await tx<{ id: string }[]>`
            update role set name = ${def.name}, description = ${def.description}, is_system = true, updated_at = now()
            where id = ${existing.id} returning id`
        : await tx<{ id: string }[]>`
            insert into role (key, name, description, is_system) values (${key}, ${def.name}, ${def.description}, true) returning id`;

      await tx`delete from role_permission where role_id = ${role.id}`;
      if (def.permissions.length > 0) {
        await tx`
          insert into role_permission (role_id, permission_id)
          select ${role.id}, id from permission where key = any(${[...def.permissions]}::text[])`;
      }
    }
  });
}
