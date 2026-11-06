import "server-only";
import type { Db } from "@/server/database/client";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

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
  metadata?: Record<string, Json>;
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
export async function recordAudit(tx: Db, event: AuditEvent): Promise<void> {
  const metadata = event.metadata === undefined ? null : (sanitize(event.metadata) as Json);
  await tx`
    insert into audit_log (organization_id, actor_user_id, action, target_type, target_id, source, correlation_id, metadata)
    values (${event.organizationId}, ${event.actorUserId}, ${event.action}, ${event.targetType ?? null}, ${event.targetId ?? null},
            ${event.source ?? "web"}, ${event.correlationId ?? null}, ${metadata === null ? null : tx.json(metadata)})`;
}
