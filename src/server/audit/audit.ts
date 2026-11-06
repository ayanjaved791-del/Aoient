import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/database/client";

export type AuditAction =
  | "organization.created"
  | "organization.updated"
  | "member.invited"
  | "member.invitation_revoked"
  | "member.joined"
  | "member.role_changed"
  | "member.suspended"
  | "member.reactivated"
  | "member.removed"
  | "member.left"
  | "role.created"
  | "role.updated"
  | "role.deleted";

export interface AuditEvent {
  organizationId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  source?: "web" | "api" | "system" | "webhook";
  correlationId?: string;
  /** Sanitised, non-sensitive context only. Never secrets, tokens or payment payloads. */
  metadata?: Prisma.InputJsonValue;
}

const FORBIDDEN_METADATA_KEYS = /pass(word)?|secret|token|authorization|cookie|card/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !FORBIDDEN_METADATA_KEYS.test(k))
        .map(([k, v]) => [k, sanitize(v)]),
    );
  }
  return value;
}

/** Write an audit event inside the caller's transaction so it commits atomically with the change. */
export async function recordAudit(tx: Tx, event: AuditEvent): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: event.organizationId,
      actorUserId: event.actorUserId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      source: event.source ?? "web",
      correlationId: event.correlationId,
      metadata: event.metadata === undefined ? undefined : (sanitize(event.metadata) as Prisma.InputJsonValue),
    },
  });
}
