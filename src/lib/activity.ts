/**
 * Turns audit-log rows into one-line, human sentences for the activity feed.
 * Pure (no server imports) so it can be unit tested.
 */

export interface ActivityRow {
  id: string;
  action: string;
  source: "web" | "api" | "system" | "webhook";
  actorName: string | null;
  /** Display name of the member/user the event is about, when there is one. */
  subjectName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export type ActivityKind = "organization" | "member" | "role" | "billing" | "people";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  actor: string;
  text: string;
  createdAt: Date;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const PLAN_NAMES: Record<string, string> = { medisea: "Medisea", indiana: "Indiana", pacfic_deepdive: "Pacfic-DeepDive" };

export function describeActivity(row: ActivityRow): ActivityItem {
  const m = row.metadata ?? {};
  const actor = row.actorName ?? (row.source === "webhook" ? "Paddle" : row.source === "system" ? "Aoient" : "Someone");
  const subject = row.subjectName ?? "a member";
  const kind: ActivityKind = row.action.startsWith("people.")
    ? "people"
    : row.action.startsWith("role.")
    ? "role"
    : row.action.startsWith("billing.")
      ? "billing"
      : row.action.startsWith("member.")
        ? "member"
        : "organization";

  let text: string;
  switch (row.action) {
    case "organization.created":
      text = `created ${str(m.name) ?? "the organization"}`;
      break;
    case "organization.updated": {
      const fields = Object.keys(m).map((k) => k.replace(/([A-Z])/g, " $1").toLowerCase());
      text = fields.length ? `updated the organization's ${fields.join(", ")}` : "updated the organization settings";
      break;
    }
    case "member.invited":
      text = `invited ${str(m.email) ?? "someone"}${str(m.role) ? ` as ${m.role}` : ""}`;
      break;
    case "member.login_created":
      text = `created a login for ${str(m.name) ?? subject}${str(m.role) ? ` as ${m.role}` : ""}`;
      break;
    case "member.password_reset":
      text = `set a temporary password for ${subject}`;
      break;
    case "member.invitation_revoked":
      text = "revoked an invitation";
      break;
    case "member.joined":
      text = "joined the organization";
      break;
    case "member.role_changed":
      text = `changed ${subject}'s role${str(m.fromRole) ? ` from ${m.fromRole}` : ""}${str(m.toRole) ? ` to ${m.toRole}` : ""}`;
      break;
    case "member.suspended":
      text = `suspended ${subject}`;
      break;
    case "member.reactivated":
      text = `reactivated ${subject}`;
      break;
    case "member.removed":
      text = `removed ${subject}`;
      break;
    case "member.left":
      text = "left the organization";
      break;
    case "role.created":
      text = str(m.name) ? `created the ${m.name} role` : "created a role";
      break;
    case "role.updated":
      text = str(m.name) ? `updated the ${m.name} role` : "updated a role";
      break;
    case "role.deleted":
      text = str(m.name) ? `deleted the ${m.name} role` : "deleted a role";
      break;
    case "billing.license_updated": {
      const plan = str(m.plan) ? (PLAN_NAMES[m.plan as string] ?? (m.plan as string)) : "the";
      const status = str(m.status);
      text = `updated the subscription: ${plan} plan${status ? ` (${status.replace("_", " ")})` : ""}`;
      break;
    }
    case "people.employee_created":
      text = `added ${str(m.name) ?? "an employee"} to People`;
      break;
    case "people.employee_updated": {
      const fields = Array.isArray(m.fields) ? (m.fields as unknown[]).filter((f): f is string => typeof f === "string") : [];
      text = `updated ${str(m.name) ?? "an employee"}'s ${fields.length ? fields.map((f) => f.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ") : "record"}`;
      break;
    }
    case "people.employee_archived":
      text = `archived ${str(m.name) ?? "an employee"}`;
      break;
    case "people.employee_restored":
      text = `restored ${str(m.name) ?? "an employee"}`;
      break;
    case "people.department_created":
      text = `created the ${str(m.name) ?? "new"} department`;
      break;
    case "people.department_updated":
      text = `updated the ${str(m.name) ?? ""} department`.replace("the  department", "a department");
      break;
    case "people.department_deleted":
      text = `deleted the ${str(m.name) ?? ""} department`.replace("the  department", "a department");
      break;
    case "people.leave_requested":
      text = `requested ${str(m.type) ?? ""} leave${typeof m.days === "number" ? ` (${m.days} day${m.days === 1 ? "" : "s"})` : ""}`.replace("  ", " ");
      break;
    case "people.leave_approved":
      text = `approved ${str(m.name) ? `${m.name}'s` : "a"} leave request`;
      break;
    case "people.leave_rejected":
      text = `declined ${str(m.name) ? `${m.name}'s` : "a"} leave request`;
      break;
    case "people.leave_cancelled":
      text = "cancelled a leave request";
      break;
    default:
      text = row.action.replace(/[._]/g, " ");
  }
  return { id: row.id, kind, actor, text, createdAt: row.createdAt };
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a date. */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return "just now";
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
