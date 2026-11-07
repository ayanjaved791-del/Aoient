import "server-only";
import { getDb } from "@/server/database/client";
import { can, type OrgContext } from "@/server/tenancy/context";
import { MODULES, PERMISSIONS } from "@/server/permissions/catalog";
import { listMembers, type MemberRow } from "@/server/organizations/organizations";
import { listPendingInvitations } from "@/server/organizations/invitations";
import { listRoles } from "@/server/organizations/roles";
import { getLicenseOverview } from "@/server/billing/license";
import { listActivitySince } from "@/server/audit/activity";
import { getDashboard, type DashboardRange } from "@/server/dashboard/dashboard";
import { daysLeft } from "@/lib/billing/entitlements";
import { timeAgo } from "@/lib/activity";
import { parseQuestion, type Intent } from "@/lib/assistant/intents";

export interface AssistantAnswer {
  intent: Intent;
  text: string;
  stats?: { label: string; value: string }[];
  items?: { title: string; subtitle?: string; meta?: string }[];
  links?: { href: string; label: string }[];
  suggestions?: string[];
  /** True when the answer was limited by the person's role. */
  restricted?: boolean;
}

/**
 * What the assistant may tell this person, from their role's permissions:
 *  - team: details about other people (Owner, Admin, or a role that manages members)
 *  - invites / billing / audit / roles: those areas
 * Everyone can always ask about themselves.
 */
export function assistantScope(ctx: OrgContext) {
  const team = can(ctx, "organization.members.manage");
  return {
    team,
    invites: can(ctx, "organization.members.invite"),
    billing: can(ctx, "billing.read"),
    audit: can(ctx, "organization.audit.read"),
    roles: team || can(ctx, "organization.roles.manage"),
    workspace: can(ctx, "organization.read"),
  };
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const toRange = (days: number | null): DashboardRange => (days === null || days > 30 ? (days && days > 30 ? 90 : 30) : days <= 7 ? 7 : 30);

export function suggestionsFor(ctx: OrgContext): string[] {
  const s = assistantScope(ctx);
  const out = ["What is my role?", "What can I do here?", "What did I do this week?"];
  if (s.team) out.unshift("Give me a summary", "How many members do we have?", "Who joined recently?", "List all admins");
  if (s.invites) out.push("Which invitations are pending?");
  if (s.billing) out.push("How many days are left on our plan?", "Are we close to our limits?");
  if (s.audit) out.push("What happened today?", "Who is most active this month?");
  if (s.roles) out.push("What can a Project Manager do?");
  out.push("How do I install the app?");
  return [...new Set(out)];
}

function denied(intent: Intent, ctx: OrgContext, what: string): AssistantAnswer {
  return {
    intent,
    restricted: true,
    text: `Your role (${ctx.roleName}) can't see ${what}. I can only share what your role allows. Ask an Owner or Admin if you need it.`,
    suggestions: suggestionsFor(ctx).slice(0, 4),
  };
}

async function myMembership(ctx: OrgContext) {
  const [row] = await getDb()<{ joined_at: Date; name: string; email: string }[]>`
    select m.joined_at, p.name, p.email from organization_member m join profile p on p.id = m.user_id
    where m.id = ${ctx.memberId} and m.organization_id = ${ctx.organizationId}`;
  return row;
}

function memberItem(m: MemberRow, now: Date) {
  return { title: m.name || m.email, subtitle: `${m.role.name} · ${m.email}`, meta: m.status === "suspended" ? "Suspended" : `Joined ${timeAgo(m.joinedAt, now)}` };
}

/** Answers one question with data from the caller's organization only, within their role's limits. */
export async function answerQuestion(ctx: OrgContext, question: string): Promise<AssistantAnswer> {
  const s = assistantScope(ctx);
  const base = `/${ctx.organization.slug}`;
  const now = new Date();
  // Role names help match "list admins" / "what can HR Manager do"; system role names are not secret.
  const roleNames = s.roles ? (await listRoles(ctx)).map((r) => r.name) : ["Owner", "Admin", "HR Manager", "Sales Manager", "Project Manager", "Finance Manager", "Employee", "Client / Guest"];
  const p = parseQuestion(question, roleNames);
  const period = p.days ?? 30;
  const periodLabel = p.periodLabel ?? "the last 30 days";

  switch (p.intent) {
    case "greeting":
    case "help":
      return {
        intent: p.intent,
        text: s.team
          ? `Hi! I can answer questions about ${ctx.organization.name}: your team, roles, invitations, plan, usage and recent activity. Everything comes straight from your workspace's records.`
          : `Hi! I can tell you about your own account in ${ctx.organization.name}: your role, what you're allowed to do and what you've changed. Your role (${ctx.roleName}) doesn't include details about other people.`,
        suggestions: suggestionsFor(ctx),
      };

    case "me": {
      const me = await myMembership(ctx);
      return {
        intent: p.intent,
        text: `You're ${me?.name || "a member"} and your role in ${ctx.organization.name} is ${ctx.roleName}.`,
        stats: [
          { label: "Role", value: ctx.roleName },
          { label: "Email", value: me?.email ?? "—" },
          { label: "Member since", value: me ? fmtDate(me.joined_at) : "—" },
          { label: "Permissions", value: String(ctx.permissions.size) },
        ],
        suggestions: ["What can I do here?", "What did I do this week?"],
      };
    }

    case "my_permissions":
    case "role_detail": {
      if (p.intent === "role_detail" && p.role && p.role !== ctx.roleName) {
        if (!s.roles) return denied(p.intent, ctx, "what other roles can do");
        const role = (await listRoles(ctx)).find((r) => r.name === p.role);
        if (role) {
          const released = PERMISSIONS.filter((x) => role.permissions.includes(x.key) && MODULES[x.module].released);
          const later = role.permissions.length - released.length;
          return {
            intent: p.intent,
            text: `${role.name}${role.description ? `: ${role.description}` : ""} ${plural(role.memberCount, "person", "people")} ${role.memberCount === 1 ? "has" : "have"} this role.`,
            items: released.map((x) => ({ title: x.description, subtitle: MODULES[x.module].label })),
            ...(later > 0 ? { stats: [{ label: "Permissions for upcoming modules", value: String(later) }] } : {}),
            links: [{ href: `${base}/settings/roles`, label: "Open Roles & permissions" }],
          };
        }
      }
      const mine = PERMISSIONS.filter((x) => ctx.permissions.has(x.key) && MODULES[x.module].released);
      return {
        intent: p.intent,
        text: mine.length
          ? `As ${ctx.roleName}, you can do ${plural(mine.length, "thing")} in the parts of Aoient that are live today:`
          : `As ${ctx.roleName}, you don't have permissions in the parts of Aoient that are live today. Items shared with you will appear when the client portal ships.`,
        items: mine.map((x) => ({ title: x.description, subtitle: MODULES[x.module].label })),
      };
    }

    case "my_activity": {
      const { total, items } = await listActivitySince(ctx, { days: period, limit: 8, onlyMine: true });
      return {
        intent: p.intent,
        text: total ? `You made ${plural(total, "recorded change")} in ${periodLabel}.` : `You haven't made any recorded changes in ${periodLabel}.`,
        items: items.map((i) => ({ title: `You ${i.text}`, meta: timeAgo(i.createdAt, now) })),
      };
    }

    case "summary": {
      if (!s.team) return denied(p.intent, ctx, "a summary of the whole workspace");
      const d = await getDashboard(ctx, toRange(p.days));
      const { license } = await getLicenseOverview(ctx.organizationId);
      const t = d.team!;
      const left = license?.state === "trial" ? daysLeft(license.trialEndsAt) : null;
      return {
        intent: p.intent,
        text: `${ctx.organization.name} has ${plural(t.activeMembers, "active member")}; ${t.joinedInRange} joined in the last ${d.range} days.${d.activity ? ` ${plural(d.activity.total, "change")} were recorded in that time.` : ""}`,
        stats: [
          { label: "Active members", value: license ? `${t.activeMembers} / ${license.entitlements.maxMembers}` : String(t.activeMembers) },
          { label: "Pending invitations", value: String(t.invitations.pending) },
          { label: `Joined (${d.range} d)`, value: String(t.joinedInRange) },
          ...(d.activity ? [{ label: `Changes (${d.range} d)`, value: String(d.activity.total) }] : []),
          ...(s.billing && license ? [{ label: "Plan", value: left !== null ? `${license.planName} · ${left} d left` : `${license.planName} · ${license.state}` }] : []),
          ...(t.suspendedMembers ? [{ label: "Suspended", value: String(t.suspendedMembers) }] : []),
        ],
        links: [{ href: base, label: "Open dashboard" }],
      };
    }

    case "member_count": {
      if (!s.team) return denied(p.intent, ctx, "details about other members");
      const members = await listMembers(ctx);
      const active = members.filter((m) => m.status === "active").length;
      return {
        intent: p.intent,
        text: `${ctx.organization.name} has ${plural(active, "active member")}${members.length > active ? ` and ${members.length - active} suspended` : ""}.`,
        stats: Object.entries(members.filter((m) => m.status === "active").reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.role.name]: (acc[m.role.name] ?? 0) + 1 }), {}))
          .sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, value: String(n) })),
        links: [{ href: `${base}/settings/members`, label: "Open Members" }],
      };
    }

    case "members_list": {
      if (!s.team) return denied(p.intent, ctx, "the list of other members");
      let members = (await listMembers(ctx)).filter((m) => m.status === "active");
      if (p.role) members = members.filter((m) => m.role.name === p.role);
      return {
        intent: p.intent,
        text: members.length ? `${p.role ? `${plural(members.length, p.role)}` : plural(members.length, "active member")}:` : `No active members${p.role ? ` with the ${p.role} role` : ""}.`,
        items: members.slice(0, 20).map((m) => memberItem(m, now)),
        ...(members.length > 20 ? { stats: [{ label: "Showing", value: `20 of ${members.length}` }] } : {}),
        links: [{ href: `${base}/settings/members`, label: "Open Members" }],
      };
    }

    case "member_lookup": {
      if (!s.team) return denied(p.intent, ctx, "details about other members");
      if (!p.person) return { intent: p.intent, text: "Who should I look up? Try a name or an email, like “Who is Ali?”." };
      const found = await listMembers(ctx, { query: p.person });
      return {
        intent: p.intent,
        text: found.length ? `I found ${plural(found.length, "member")} matching “${p.person}”:` : `No member matches “${p.person}”.`,
        items: found.slice(0, 10).map((m) => memberItem(m, now)),
      };
    }

    case "recent_members": {
      if (!s.team) return denied(p.intent, ctx, "who else joined");
      const since = now.getTime() - period * 86_400_000;
      const recent = (await listMembers(ctx)).filter((m) => m.joinedAt.getTime() >= since).sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
      return {
        intent: p.intent,
        text: recent.length ? `${plural(recent.length, "person", "people")} joined in ${periodLabel}:` : `No one joined in ${periodLabel}.`,
        items: recent.slice(0, 15).map((m) => memberItem(m, now)),
      };
    }

    case "suspended_members": {
      if (!s.team) return denied(p.intent, ctx, "member statuses");
      const sus = await listMembers(ctx, { status: "suspended" });
      return {
        intent: p.intent,
        text: sus.length ? `${plural(sus.length, "member is", "members are")} suspended:` : "No members are suspended.",
        items: sus.map((m) => memberItem(m, now)),
      };
    }

    case "invites_pending": {
      if (!s.invites) return denied(p.intent, ctx, "invitations");
      const inv = (await listPendingInvitations(ctx)).filter((i) => i.status === "pending");
      return {
        intent: p.intent,
        text: inv.length ? `${plural(inv.length, "invitation is", "invitations are")} waiting to be accepted:` : "There are no pending invitations.",
        items: inv.map((i) => ({ title: i.email, subtitle: `${i.roleName}${i.invitedByName ? ` · invited by ${i.invitedByName}` : ""}`, meta: `Expires ${fmtDate(i.expiresAt)}` })),
        links: [{ href: `${base}/settings/members`, label: "Manage invitations" }],
      };
    }

    case "invites_stats": {
      if (!s.invites || !s.team) return denied(p.intent, ctx, "invitation statistics");
      const d = await getDashboard(ctx, toRange(p.days));
      const i = d.team!.invitations;
      return {
        intent: p.intent,
        text: i.sent ? `${i.accepted} of ${i.sent} invitations sent in the last ${d.range} days were accepted (${Math.round((i.accepted / i.sent) * 100)}%).` : `No invitations were sent in the last ${d.range} days.`,
        stats: [
          { label: "Sent", value: String(i.sent) }, { label: "Accepted", value: String(i.accepted) },
          { label: "Expired", value: String(i.expired) }, { label: "Revoked", value: String(i.revoked) },
          ...(d.team!.medianAcceptHours !== null ? [{ label: "Median time to accept", value: `${d.team!.medianAcceptHours} h` }] : []),
        ],
      };
    }

    case "roles_list": {
      if (!s.roles) return denied(p.intent, ctx, "the list of roles");
      const roles = await listRoles(ctx);
      return {
        intent: p.intent,
        text: `${ctx.organization.name} has ${plural(roles.length, "role")} (${roles.filter((r) => !r.isSystem).length} custom):`,
        items: roles.map((r) => ({ title: r.name, subtitle: r.description ?? (r.isSystem ? "Built-in role" : "Custom role"), meta: plural(r.memberCount, "member") })),
        links: [{ href: `${base}/settings/roles`, label: "Open Roles & permissions" }],
      };
    }

    case "plan":
    case "usage": {
      if (!s.billing) return denied(p.intent, ctx, "the plan and billing");
      const { license, usage } = await getLicenseOverview(ctx.organizationId);
      if (!license) return { intent: p.intent, text: "This workspace has no active plan, so it's read-only until one is chosen.", links: [{ href: `${base}/settings/billing`, label: "Choose a plan" }] };
      const e = license.entitlements;
      const left = license.state === "trial" ? daysLeft(license.trialEndsAt) : null;
      const status = license.state === "trial"
        ? `${license.source === "paddle" ? "a paid plan in its free trial" : "a free trial"} with ${plural(left ?? 0, "day")} left`
        : license.state === "active" ? `active (${license.billingInterval ?? "monthly"} billing)`
          : license.state === "canceling" ? `canceled, ending ${license.currentPeriodEndsAt ? fmtDate(license.currentPeriodEndsAt) : "soon"}`
            : license.state === "past_due" ? "past due: the last payment failed" : "expired (read-only)";
      const used = usage.activeMembers + usage.pendingInvitations;
      const near = used / e.maxMembers >= 0.8 || usage.adminSeats >= e.maxAdminSeats;
      return {
        intent: p.intent,
        text: p.intent === "usage"
          ? `You're using ${used} of ${e.maxMembers} user seats and ${usage.adminSeats} of ${e.maxAdminSeats} admin seats.${near ? " You're close to a limit." : " There's room to grow."}`
          : `You're on the ${license.planName} plan, which is ${status}.`,
        stats: [
          { label: "Plan", value: license.planName },
          { label: "Users", value: `${used} / ${e.maxMembers}` },
          { label: "Admin seats", value: `${usage.adminSeats} / ${e.maxAdminSeats}` },
          { label: "Custom roles", value: e.customRoles ? `${usage.customRoles} (unlimited)` : "Not included" },
          ...(left !== null && license.trialEndsAt ? [{ label: "Trial ends", value: fmtDate(license.trialEndsAt) }] : []),
          ...(license.currentPeriodEndsAt ? [{ label: "Current period ends", value: fmtDate(license.currentPeriodEndsAt) }] : []),
        ],
        links: [{ href: `${base}/settings/billing`, label: "Open Billing & plan" }],
      };
    }

    case "activity": {
      if (!s.audit) {
        const mine = await listActivitySince(ctx, { days: period, limit: 8, onlyMine: true });
        return {
          intent: p.intent,
          restricted: true,
          text: `Your role (${ctx.roleName}) can't see everyone's activity, so here is just yours: ${plural(mine.total, "change")} in ${periodLabel}.`,
          items: mine.items.map((i) => ({ title: `You ${i.text}`, meta: timeAgo(i.createdAt, now) })),
        };
      }
      const { total, items } = await listActivitySince(ctx, { days: period, limit: 10 });
      return {
        intent: p.intent,
        text: total ? `${plural(total, "change was", "changes were")} recorded in ${periodLabel}. The latest:` : `Nothing was recorded in ${periodLabel}.`,
        items: items.map((i) => ({ title: `${i.actor} ${i.text}`, meta: timeAgo(i.createdAt, now) })),
        links: [{ href: base, label: "Open dashboard" }],
      };
    }

    case "top_people": {
      if (!s.audit) return denied(p.intent, ctx, "other people's activity");
      const d = await getDashboard(ctx, toRange(p.days));
      const top = d.activity!.topPeople;
      return {
        intent: p.intent,
        text: top.length ? `Most active in the last ${d.range} days:` : `No changes were recorded in the last ${d.range} days.`,
        items: top.map((t, i) => ({ title: `${i + 1}. ${t.name}`, meta: plural(t.count, "change") })),
      };
    }

    case "workspace": {
      if (!s.workspace) return denied(p.intent, ctx, "workspace settings");
      return {
        intent: p.intent,
        text: `${ctx.organization.name} uses the URL /${ctx.organization.slug}.`,
        stats: [
          { label: "Name", value: ctx.organization.name },
          { label: "URL", value: `/${ctx.organization.slug}` },
          { label: "Time zone", value: ctx.organization.timezone.replaceAll("_", " ") },
          { label: "Currency", value: ctx.organization.currency },
        ],
        links: [{ href: `${base}/settings/general`, label: "Open General settings" }],
      };
    }

    case "howto_invite":
      return s.invites
        ? { intent: p.intent, text: "Go to Members and press “Invite member”. Enter their email, pick a role, and press “Create invite link”. Copy the link or share it on WhatsApp; it works once, only for that email, for 7 days.", links: [{ href: `${base}/settings/members`, label: "Open Members" }] }
        : denied(p.intent, ctx, "invitations (inviting people)");
    case "howto_role":
      return s.team || can(ctx, "organization.roles.manage")
        ? { intent: p.intent, text: "To change someone's role, open Members and pick a new role in their row. To create a custom role, open Roles & permissions and press “New role” (Indiana plan and above).", links: [{ href: `${base}/settings/members`, label: "Open Members" }, { href: `${base}/settings/roles`, label: "Open Roles" }] }
        : denied(p.intent, ctx, "role changes");
    case "howto_install":
      return { intent: p.intent, text: "Open the account menu (your initials, top right) and choose “Install Aoient app”. On iPhone, use Safari's Share button → Add to Home Screen.", links: [{ href: "/download", label: "Install steps for every device" }] };
    case "howto_billing":
      return can(ctx, "billing.manage")
        ? { intent: p.intent, text: "Open Billing & plan. Choose a plan to start or upgrade; “Manage subscription” opens Paddle's portal to change the card or cancel.", links: [{ href: `${base}/settings/billing`, label: "Open Billing & plan" }] }
        : denied(p.intent, ctx, "billing changes (only the Owner can change the plan)");

    case "unknown":
    default:
      return {
        intent: "unknown",
        text: "I didn't quite get that. I answer questions about this workspace from its records. Try one of these:",
        suggestions: suggestionsFor(ctx).slice(0, 6),
      };
  }
}
