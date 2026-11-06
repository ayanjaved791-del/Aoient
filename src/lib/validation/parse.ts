import type { z } from "zod";
import { ValidationError } from "@/lib/errors";

/** Parse untrusted input; throw a ValidationError with per-field messages on failure. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    (fields[key] ??= []).push(issue.message);
  }
  throw new ValidationError("Check the highlighted fields", fields);
}
