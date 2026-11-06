import "server-only";
import postgres from "postgres";

/** True for a Postgres unique-constraint violation, optionally on a constraint/index whose name contains `name`. */
export function isUniqueViolation(e: unknown, name?: string): boolean {
  if (!(e instanceof postgres.PostgresError) || e.code !== "23505") return false;
  return !name || (e.constraint_name ?? "").includes(name);
}
