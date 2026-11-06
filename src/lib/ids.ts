const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** IDs are UUIDs; anything else can't match a row (and must not reach a uuid column, which would error). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
