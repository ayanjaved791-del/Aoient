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

export type ActivityKind = "organization" | "member" | "role" | "billing";

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
  const kind: ActivityKind = row.action.startsWith("role.")
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
