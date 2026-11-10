import "server-only";
import type { Db } from "@/server/database/client";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type AuditAction =
  | "organization.created"
  | "organization.updated"
  | "organization.logo_updated"
  | "organization.logo_removed"
  | "member.invited"
  | "member.login_created"
  | "member.password_reset"
  | "member.invitation_revoked"
  | "member.joined"
  | "member.role_changed"
  | "member.suspended"
  | "member.reactivated"
  | "member.removed"
  | "member.left"
  | "role.created"
  | "role.updated"
  | "role.deleted"
  | "billing.license_updated"
  | "people.employee_created"
  | "people.employee_updated"
  | "people.employee_archived"
  | "people.employee_restored"
  | "people.department_created"
  | "people.department_updated"
  | "people.department_deleted"
  | "people.leave_requested"
  | "people.leave_approved"
  | "people.leave_rejected"
  | "people.leave_cancelled"
  | "crm.company_created"
  | "crm.company_updated"
  | "crm.company_archived"
  | "crm.company_restored"
  | "crm.contact_created"
  | "crm.contact_updated"
  | "crm.contact_archived"
  | "crm.contact_restored"
  | "crm.lead_created"
  | "crm.lead_updated"
  | "crm.lead_archived"
  | "crm.lead_converted"
  | "crm.deal_created"
  | "crm.deal_updated"
  | "crm.deal_moved"
  | "crm.deal_won"
  | "crm.deal_lost"
  | "crm.deal_archived"
  | "crm.stage_created"
  | "crm.stage_updated"
  | "crm.stage_deleted"
  | "crm.stages_reordered"
  | "crm.note_added"
  | "projects.project_created"
  | "projects.project_updated"
  | "projects.project_archived"
  | "projects.project_restored"
  | "projects.milestone_created"
  | "projects.milestone_updated"
  | "projects.milestone_deleted"
  | "projects.task_created"
  | "projects.task_updated"
  | "projects.task_moved"
  | "projects.task_completed"
  | "projects.task_deleted"
  | "projects.comment_added"
  | "finance.vendor_created"
  | "finance.vendor_updated"
  | "finance.vendor_archived"
  | "finance.vendor_restored"
  | "finance.invoice_created"
  | "finance.invoice_updated"
  | "finance.invoice_issued"
  | "finance.invoice_voided"
  | "finance.invoice_deleted"
  | "finance.estimate_created"
  | "finance.estimate_updated"
  | "finance.estimate_status_changed"
  | "finance.estimate_converted"
  | "finance.estimate_deleted"
  | "finance.payment_recorded"
  | "finance.payment_deleted"
  | "finance.expense_created"
  | "finance.expense_updated"
  | "finance.expense_approved"
  | "finance.expense_rejected"
  | "finance.expense_paid"
  | "finance.expense_deleted"
  | "finance.template_updated"
  | "time.timesheet_submitted"
  | "time.timesheet_withdrawn"
  | "time.timesheet_approved"
  | "time.timesheet_rejected"
  | "time.hours_billed";

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
