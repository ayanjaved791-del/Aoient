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

export type ActivityKind = "organization" | "member" | "role" | "billing" | "people" | "crm" | "projects";

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
    : row.action.startsWith("crm.")
    ? "crm"
    : row.action.startsWith("projects.")
    ? "projects"
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
    case "organization.logo_updated":
      text = "changed the organization logo";
      break;
    case "organization.logo_removed":
      text = "removed the organization logo";
      break;
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
    case "crm.company_created": text = `added the company ${str(m.name) ?? ""}`.trim(); break;
    case "crm.company_updated": text = `updated the company ${str(m.name) ?? ""}`.trim(); break;
    case "crm.company_archived": text = `archived the company ${str(m.name) ?? ""}`.trim(); break;
    case "crm.company_restored": text = `restored the company ${str(m.name) ?? ""}`.trim(); break;
    case "crm.contact_created": text = `added the contact ${str(m.name) ?? ""}`.trim(); break;
    case "crm.contact_updated": text = `updated the contact ${str(m.name) ?? ""}`.trim(); break;
    case "crm.contact_archived": text = `archived the contact ${str(m.name) ?? ""}`.trim(); break;
    case "crm.contact_restored": text = `restored the contact ${str(m.name) ?? ""}`.trim(); break;
    case "crm.lead_created": text = `added the lead ${str(m.name) ?? ""}`.trim(); break;
    case "crm.lead_updated": text = `updated the lead ${str(m.name) ?? ""}`.trim(); break;
    case "crm.lead_archived": text = `archived the lead ${str(m.name) ?? ""}`.trim(); break;
    case "crm.lead_converted": text = `converted the lead ${str(m.name) ?? ""}${m.deal ? " into a deal" : ""}`.replace("  ", " "); break;
    case "crm.deal_created": text = `added the deal ${str(m.title) ?? ""}`.trim(); break;
    case "crm.deal_updated": text = `updated the deal ${str(m.title) ?? ""}`.trim(); break;
    case "crm.deal_moved": text = `moved ${str(m.title) ?? "a deal"} to ${str(m.stage) ?? "another stage"}`; break;
    case "crm.deal_won": text = `won the deal ${str(m.title) ?? ""}`.trim(); break;
    case "crm.deal_lost": text = `marked ${str(m.title) ?? "a deal"} as lost`; break;
    case "crm.deal_archived": text = `archived the deal ${str(m.title) ?? ""}`.trim(); break;
    case "crm.stage_created": text = `added the pipeline stage ${str(m.name) ?? ""}`.trim(); break;
    case "crm.stage_updated": text = `updated the pipeline stage ${str(m.name) ?? ""}`.trim(); break;
    case "crm.stage_deleted": text = `deleted the pipeline stage ${str(m.name) ?? ""}`.trim(); break;
    case "crm.stages_reordered": text = "reordered the pipeline stages"; break;
    case "projects.project_created": text = `started the project ${str(m.name) ?? ""}`.trim(); break;
    case "projects.project_updated": text = `updated the project ${str(m.name) ?? ""}`.trim(); break;
    case "projects.project_archived": text = `archived the project ${str(m.name) ?? ""}`.trim(); break;
    case "projects.project_restored": text = `restored the project ${str(m.name) ?? ""}`.trim(); break;
    case "projects.milestone_created": text = `added the milestone ${str(m.name) ?? ""} to ${str(m.project) ?? "a project"}`; break;
    case "projects.milestone_updated": text = m.done === true ? `reached the milestone ${str(m.name) ?? ""} in ${str(m.project) ?? "a project"}` : `updated the milestone ${str(m.name) ?? ""}`.trim(); break;
    case "projects.milestone_deleted": text = `removed the milestone ${str(m.name) ?? ""}`.trim(); break;
    case "projects.task_created": text = `added the task ${str(m.title) ?? ""} to ${str(m.project) ?? "a project"}`; break;
    case "projects.task_updated": text = `updated the task ${str(m.title) ?? ""}`.trim(); break;
    case "projects.task_moved": text = `moved ${str(m.title) ?? "a task"} to ${({ todo: "To do", in_progress: "In progress", review: "Review", done: "Done" } as Record<string, string>)[String(m.status)] ?? "another column"}`; break;
    case "projects.task_completed": text = `finished the task ${str(m.title) ?? ""}`.trim(); break;
    case "projects.task_deleted": text = `deleted the task ${str(m.title) ?? ""}`.trim(); break;
    case "projects.comment_added": text = `commented on ${str(m.title) ?? "a task"}`; break;
    case "crm.note_added": text = `added a note to a ${str(m.subject) ?? "record"}`; break;
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
