/**
 * Domain errors. Services throw these; the API layer and server actions map
 * them to safe responses. Never put secrets or raw DB errors in `message`.
 */
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor(code: ErrorCode, message: string, status: number, fields?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this action") {
    super("FORBIDDEN", message, 403);
  }
}

/** Also used for cross-tenant access so record existence is never leaked. */
export class NotFoundError extends AppError {
  constructor(message = "Record not found") {
    super("NOT_FOUND", message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Check the highlighted fields", fields?: Record<string, string[]>) {
    super("VALIDATION_ERROR", message, 422, fields);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number, message = "Too many requests. Please try again later.") {
    super("RATE_LIMITED", message, 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Shape returned by server actions so forms can render inline + server errors. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fields?: Record<string, string[]> } };
