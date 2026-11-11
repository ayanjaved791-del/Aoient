import "server-only";
import { getDb } from "@/server/database/client";
import { can, type OrgContext } from "@/server/tenancy/context";
import type { PermissionKey } from "@/server/permissions/catalog";
import { ConflictError, isAppError, NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import type { ParsedCommand } from "@/lib/assistant/commands";
import { addDays, formatMinutes } from "@/lib/validation/time";
import { createLead, listLeads, setLeadArchived } from "@/server/crm/leads";
import { createCompany, listCompanies, setCompanyArchived } from "@/server/crm/contacts";
import { createProject, listProjects, setProjectArchived } from "@/server/projects/projects";
import { createTask, deleteTask } from "@/server/projects/tasks";
import { visibleProject } from "@/server/projects/shared";
import { createVendor, listVendors, setVendorArchived } from "@/server/finance/vendors";
import { createExpense, deleteExpense, listExpenses } from "@/server/finance/expenses";
import { deleteDocument, listDocuments } from "@/server/finance/documents";
import { createDepartment, deleteDepartment, listDepartments } from "@/server/people/departments";
import { createInvitation, listPendingInvitations, revokeInvitation } from "@/server/organizations/invitations";
import { listRoles } from "@/server/organizations/roles";
import { createEntry, startTimer, stopTimer, todayIn } from "@/server/time/entries";

/**
 * Turns a parsed command into a proposal the person must confirm, and runs it
 * once they do. Nothing changes when the proposal is made. On confirm, the
 * normal service runs with the person's own context, so every permission and
 * plan limit is checked again at that moment.
 */
export interface Proposal {
  id: string;
  verb: "create" | "delete" | "start" | "stop";
  title: string;
  fields: { label: string; value: string }[];
  expiresAt: string;
}
export type ProposeResult =
  | { kind: "proposal"; proposal: Proposal; text: string }
  | { kind: "reply"; text: string; restricted?: boolean; items?: { title: string; subtitle?: string }[] };

type Payload = Record<string, string | number | boolean | null>;
interface Plan { kind: string; payload: Payload; title: string; summary: string; fields: { label: string; value: string }[] }

const NEEDS: Record<string, PermissionKey[]> = {
  "create:lead": ["crm.lead.create"], "delete:lead": ["crm.lead.archive"],
  "create:company": ["crm.contact.manage"], "delete:company": ["crm.contact.manage"],
  "create:project": ["projects.project.create"], "delete:project": ["projects.project.archive"],
  "create:task": ["projects.task.create"], "delete:task": ["projects.task.read"],
  "create:vendor": ["finance.vendor.manage"], "delete:vendor": ["finance.vendor.manage"],
  "create:department": ["people.department.manage"], "delete:department": ["people.department.manage"],
  "create:expense": ["finance.expense.manage"], "delete:expense": ["finance.expense.manage"],
  "create:invitation": ["organization.members.invite"], "delete:invitation": ["organization.members.invite"],
  "create:time": ["time.entry.own"], "start:timer": ["time.entry.own"], "stop:timer": ["time.entry.own"],
  "delete:invoice": ["finance.invoice.create"], "delete:estimate": ["finance.invoice.create"],
};
const NOUN: Record<string, string> = {
  lead: "lead", company: "company", project: "project", task: "task", vendor: "vendor", department: "department", expense: "expense",
  invitation: "invitation", time: "time", timer: "timer", invoice: "invoice", estimate: "estimate",
};

const reply = (text: string, extra: Partial<Extract<ProposeResult, { kind: "reply" }>> = {}): ProposeResult => ({ kind: "reply", text, ...extra });
const lc = (s: string) => s.trim().toLowerCase();

/** One match by name: an exact (case-insensitive) match wins; otherwise a single partial match. */
function pick<T>(rows: T[], nameOf: (r: T) => string, wanted: string): { one: T } | { none: true } | { many: T[] } {
  const exact = rows.filter((r) => lc(nameOf(r)) === lc(wanted));
  if (exact.length === 1) return { one: exact[0] };
  const list = exact.length ? exact : rows;
  if (list.length === 1) return { one: list[0] };
  if (list.length === 0) return { none: true };
  return { many: list.slice(0, 8) };
}

async function findProject(ctx: OrgContext, name: string) {
  if (!can(ctx, "projects.project.read")) return { none: true } as const;
  return pick(await listProjects(ctx, { status: "all", query: name }), (p) => p.name, name);
}

const EXPENSE_GUESS: [RegExp, string][] = [
  [/\b(flight|travel|taxi|uber|careem|hotel|fuel|petrol|ticket)\b/i, "travel"], [/\b(lunch|dinner|food|meal|chai|tea|coffee)\b/i, "meals"],
  [/\b(software|license|subscription|hosting|domain|saas|figma|server)\b/i, "software"], [/\b(laptop|monitor|printer|keyboard|mouse|phone|equipment|chair)\b/i, "equipment"],
  [/\b(ads?|marketing|campaign|promotion|boost)\b/i, "marketing"], [/\b(electricity|internet|bill|utility|gas|water)\b/i, "utilities"],
  [/\b(rent|kiraya)\b/i, "rent"], [/\b(freelancer|contractor|consultant)\b/i, "contractors"], [/\b(stationery|ink|paper|office)\b/i, "office"],
];

async function plan(ctx: OrgContext, c: ParsedCommand): Promise<Plan | ProposeResult> {
  const today = todayIn(ctx.organization.timezone);
  const ask = (example: string) => reply(`Tell me a bit more, like: “${example}”.`);
  const notFound = (what: string, name: string) => reply(`I couldn't find a ${what} called “${name}” that you can see.`);
  const which = (what: string, items: { title: string; subtitle?: string }[]) =>
    reply(`More than one ${what} matches. Which one? Use the full name.`, { items });

  switch (`${c.op}:${c.entity}`) {
    case "create:lead": {
      if (!c.name) return ask("create lead Ali Khan ali@example.com");
      return { kind: "create_lead", payload: { fullName: c.name, email: c.email, companyName: c.parent }, title: `Create the lead ${c.name}`, summary: `create lead ${c.name}`,
        fields: [{ label: "Name", value: c.name }, ...(c.email ? [{ label: "Email", value: c.email }] : []), ...(c.parent ? [{ label: "Company", value: c.parent }] : []), { label: "Status", value: "New" }] };
    }
    case "create:company":
      if (!c.name) return ask("add company Margalla Clinics");
      return { kind: "create_company", payload: { name: c.name }, title: `Add the company ${c.name}`, summary: `add company ${c.name}`, fields: [{ label: "Name", value: c.name }] };
    case "create:project":
      if (!c.name) return ask("create project Gwadar Ports website");
      return { kind: "create_project", payload: { name: c.name }, title: `Start the project ${c.name}`, summary: `create project ${c.name}`,
        fields: [{ label: "Name", value: c.name }, { label: "Status", value: "Active" }, { label: "Lead", value: "You" }] };
    case "create:vendor":
      if (!c.name) return ask("add vendor CloudNest Hosting");
      return { kind: "create_vendor", payload: { name: c.name }, title: `Add the vendor ${c.name}`, summary: `add vendor ${c.name}`, fields: [{ label: "Name", value: c.name }] };
    case "create:department":
      if (!c.name) return ask("create department Design");
      return { kind: "create_department", payload: { name: c.name }, title: `Create the ${c.name} department`, summary: `create department ${c.name}`, fields: [{ label: "Name", value: c.name }] };
    case "create:expense": {
      if (!c.amount || !c.name) return ask("add expense 4500 for printer ink");
      const category = EXPENSE_GUESS.find(([re]) => re.test(c.name!))?.[1] ?? "other";
      return { kind: "create_expense", payload: { description: c.name, amount: c.amount, category, spentOn: today }, title: `Add an expense: ${c.name}`, summary: `add expense ${c.name}`,
        fields: [{ label: "For", value: c.name }, { label: "Amount", value: `${c.amount.toLocaleString("en-US")} ${ctx.organization.currency}` }, { label: "Category", value: category[0].toUpperCase() + category.slice(1) }, { label: "Date", value: "Today" }, { label: "Status", value: "Waiting for approval" }] };
    }
    case "create:invitation": {
      if (!c.email) return ask("invite ali@example.com as Employee");
      const roles = await listRoles(ctx);
      const wanted = c.role ?? "Employee";
      const role = roles.find((r) => lc(r.name) === lc(wanted)) ?? roles.find((r) => lc(r.name).startsWith(lc(wanted)) || lc(wanted).startsWith(lc(r.name)));
      if (!role) return reply(`There's no role called “${wanted}”. Roles: ${roles.map((r) => r.name).join(", ")}.`);
      return { kind: "create_invitation", payload: { email: c.email, roleId: role.id }, title: `Invite ${c.email}`, summary: `invite ${c.email} as ${role.name}`,
        fields: [{ label: "Email", value: c.email }, { label: "Role", value: role.name }, { label: "Link valid for", value: "7 days" }] };
    }
    case "create:task": {
      if (!c.name) return ask("create task Homepage design in Hunza booking site");
      if (!c.parent) return reply(`Which project is “${c.name}” for? Say it like: “create task ${c.name} in <project name>”.`);
      const p = await findProject(ctx, c.parent);
      if ("none" in p) return notFound("project", c.parent);
      if ("many" in p) return which("project", p.many.map((x) => ({ title: x.name })));
      return { kind: "create_task", payload: { projectId: p.one.id, title: c.name }, title: `Add the task ${c.name}`, summary: `add task ${c.name} to ${p.one.name}`,
        fields: [{ label: "Task", value: c.name }, { label: "Project", value: p.one.name }, { label: "Column", value: "To do" }] };
    }
    case "create:time":
    case "start:timer": {
      let projectId: string | null = null, projectName: string | null = null, taskId: string | null = null, taskName: string | null = null;
      if (c.parent) {
        const p = await findProject(ctx, c.parent);
        if ("none" in p) return notFound("project", c.parent);
        if ("many" in p) return which("project", p.many.map((x) => ({ title: x.name })));
        projectId = p.one.id; projectName = p.one.name;
        if (c.name) {
          const tasks = await getDb()<{ id: string; title: string }[]>`
            select id, title from project_task where organization_id = ${ctx.organizationId} and project_id = ${projectId} and lower(title) like ${`%${lc(c.name)}%`} limit 9`;
          const t = pick(tasks, (x) => x.title, c.name);
          if ("one" in t) { taskId = t.one.id; taskName = t.one.title; }
        }
      }
      const description = taskName ? null : c.name;
      if (c.entity === "timer") {
        return { kind: "start_timer", payload: { projectId, taskId, description }, title: "Start a timer", summary: "start a timer",
          fields: [...(description ? [{ label: "Working on", value: description }] : []), { label: "Project", value: projectName ?? "No project" }, ...(taskName ? [{ label: "Task", value: taskName }] : [])] };
      }
      const day = addDays(today, -c.daysAgo);
      return { kind: "create_time", payload: { workDate: day, duration: c.minutes, projectId, taskId, description }, title: `Log ${formatMinutes(c.minutes!)} h`, summary: `log ${formatMinutes(c.minutes!)} h`,
        fields: [{ label: "Time", value: `${formatMinutes(c.minutes!)} h` }, { label: "Day", value: c.daysAgo ? "Yesterday" : "Today" }, { label: "Project", value: projectName ?? "No project" }, ...(taskName ? [{ label: "Task", value: taskName }] : [])] };
    }
    case "stop:timer": {
      const [run] = await getDb()`select 1 from time_entry where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and minutes is null`;
      if (!run) return reply("No timer is running.");
      return { kind: "stop_timer", payload: {}, title: "Stop your timer", summary: "stop the timer", fields: [{ label: "Saves", value: "the time counted so far" }] };
    }

    // ── deletes and archives ──
    case "delete:lead": {
      if (!c.name) return ask("archive lead Ali Khan");
      const r = pick(await listLeads(ctx, { status: "all", query: c.name }), (x) => x.fullName, c.name);
      if ("none" in r) return notFound("lead", c.name);
      if ("many" in r) return which("lead", r.many.map((x) => ({ title: x.fullName, subtitle: x.email ?? x.companyName ?? undefined })));
      return { kind: "archive_lead", payload: { id: r.one.id }, title: `Archive the lead ${r.one.fullName}`, summary: `archive lead ${r.one.fullName}`,
        fields: [{ label: "Lead", value: r.one.fullName }, { label: "What happens", value: "Hidden from lists; can be restored" }] };
    }
    case "delete:company": {
      if (!c.name) return ask("archive company Margalla Clinics");
      const r = pick(await listCompanies(ctx, { query: c.name }), (x) => x.name, c.name);
      if ("none" in r) return notFound("company", c.name);
      if ("many" in r) return which("company", r.many.map((x) => ({ title: x.name })));
      return { kind: "archive_company", payload: { id: r.one.id }, title: `Archive the company ${r.one.name}`, summary: `archive company ${r.one.name}`,
        fields: [{ label: "Company", value: r.one.name }, { label: "What happens", value: "Hidden from lists; can be restored" }] };
    }
    case "delete:project": {
      if (!c.name) return ask("archive project Old website");
      const r = await findProject(ctx, c.name);
      if ("none" in r) return notFound("project", c.name);
      if ("many" in r) return which("project", r.many.map((x) => ({ title: x.name })));
      return { kind: "archive_project", payload: { id: r.one.id }, title: `Archive the project ${r.one.name}`, summary: `archive project ${r.one.name}`,
        fields: [{ label: "Project", value: r.one.name }, { label: "Tasks", value: `${r.one.tasks.total} (kept)` }, { label: "What happens", value: "Hidden from lists; can be restored" }] };
    }
    case "delete:task": {
      if (!c.name) return ask("delete task Homepage design");
      const sql = getDb();
      const rows = await sql<{ id: string; title: string; project: string }[]>`
        select t.id, t.title, p.name as project from project_task t join project p on p.id = t.project_id and p.organization_id = t.organization_id
        where t.organization_id = ${ctx.organizationId} and ${visibleProject(sql, ctx)} and lower(t.title) like ${`%${lc(c.name)}%`}
        ${c.parent ? sql`and lower(p.name) like ${`%${lc(c.parent)}%`}` : sql``} limit 9`;
      const r = pick(rows, (x) => x.title, c.name);
      if ("none" in r) return notFound("task", c.name);
      if ("many" in r) return which("task", r.many.map((x) => ({ title: x.title, subtitle: x.project })));
      return { kind: "delete_task", payload: { id: r.one.id }, title: `Delete the task ${r.one.title}`, summary: `delete task ${r.one.title}`,
        fields: [{ label: "Task", value: r.one.title }, { label: "Project", value: r.one.project }, { label: "What happens", value: "Deleted for good, with its comments" }] };
    }
    case "delete:vendor": {
      if (!c.name) return ask("archive vendor CloudNest Hosting");
      const r = pick(await listVendors(ctx, { query: c.name }), (x) => x.name, c.name);
      if ("none" in r) return notFound("vendor", c.name);
      if ("many" in r) return which("vendor", r.many.map((x) => ({ title: x.name })));
      return { kind: "archive_vendor", payload: { id: r.one.id }, title: `Archive the vendor ${r.one.name}`, summary: `archive vendor ${r.one.name}`,
        fields: [{ label: "Vendor", value: r.one.name }, { label: "What happens", value: "Hidden; past expenses keep it" }] };
    }
    case "delete:department": {
      if (!c.name) return ask("delete department Design");
      const r = pick((await listDepartments(ctx)).filter((d) => lc(d.name).includes(lc(c.name!))), (x) => x.name, c.name);
      if ("none" in r) return notFound("department", c.name);
      if ("many" in r) return which("department", r.many.map((x) => ({ title: x.name })));
      return { kind: "delete_department", payload: { id: r.one.id }, title: `Delete the ${r.one.name} department`, summary: `delete department ${r.one.name}`,
        fields: [{ label: "Department", value: r.one.name }, { label: "People in it", value: `${r.one.employeeCount} (they stay, without a department)` }] };
    }
    case "delete:expense": {
      if (!c.name) return ask("delete expense printer ink");
      const r = pick((await listExpenses(ctx, { query: c.name })).filter((e) => e.status === "pending" || e.status === "rejected"), (x) => x.description, c.name);
      if ("none" in r) return reply(`I couldn't find a pending or rejected expense called “${c.name}”. Approved expenses stay on record.`);
      if ("many" in r) return which("expense", r.many.map((x) => ({ title: x.description, subtitle: `${x.amount} ${x.currency} · ${x.spentOn}` })));
      return { kind: "delete_expense", payload: { id: r.one.id }, title: `Delete the expense ${r.one.description}`, summary: `delete expense ${r.one.description}`,
        fields: [{ label: "Expense", value: r.one.description }, { label: "Amount", value: `${r.one.amount} ${r.one.currency}` }] };
    }
    case "delete:invoice":
    case "delete:estimate": {
      const kind = c.entity as "invoice" | "estimate";
      if (!c.name) return ask(`delete ${kind} ${kind === "invoice" ? "INV-0003" : "EST-0002"}`);
      const r = pick(await listDocuments(ctx, { kind, query: c.name }), (x) => x.number, c.name);
      if ("none" in r) return notFound(kind, c.name);
      if ("many" in r) return which(kind, r.many.map((x) => ({ title: x.number, subtitle: x.billToName })));
      if (kind === "invoice" && r.one.status !== "draft") return reply(`${r.one.number} has been issued, so it stays on record. You can void it from the invoice page instead.`);
      return { kind: "delete_document", payload: { id: r.one.id }, title: `Delete ${r.one.number}`, summary: `delete ${r.one.number}`,
        fields: [{ label: kind === "invoice" ? "Draft invoice" : "Estimate", value: r.one.number }, { label: "Client", value: r.one.billToName }] };
    }
    case "delete:invitation": {
      const wanted = c.email ?? c.name;
      if (!wanted) return ask("cancel invite ali@example.com");
      const r = pick(await listPendingInvitations(ctx), (x) => x.email, wanted);
      if ("none" in r || ("one" in r && lc(r.one.email) !== lc(wanted))) return reply(`There's no open invitation for ${wanted}.`);
      if ("many" in r) return which("invitation", r.many.map((x) => ({ title: x.email })));
      return { kind: "revoke_invitation", payload: { id: r.one.id }, title: `Cancel the invitation for ${r.one.email}`, summary: `cancel invitation ${r.one.email}`,
        fields: [{ label: "Email", value: r.one.email }, { label: "Role", value: r.one.roleName }, { label: "What happens", value: "The join link stops working" }] };
    }
  }
  return reply("I can't do that from chat yet. Use the page for it.");
}

/** Builds a proposal and stores it. Nothing in the workspace changes here. */
export async function proposeCommand(ctx: OrgContext, c: ParsedCommand): Promise<ProposeResult> {
  const key = `${c.op}:${c.entity}`;
  const needs = NEEDS[key];
  if (!needs) return reply("I can't do that from chat yet. Use the page for it.");
  if (!needs.every((p) => can(ctx, p))) {
    return reply(`Your role (${ctx.roleName}) can't ${c.op === "delete" ? "remove" : c.op} ${c.entity === "time" ? "time entries" : `${NOUN[c.entity]}s`}. I only do what your role allows.`, { restricted: true });
  }
  let p: Plan | ProposeResult;
  try {
    p = await plan(ctx, c);
  } catch (e) {
    if (isAppError(e)) return reply(e.message, { restricted: e.code === "FORBIDDEN" });
    throw e;
  }
  if ("text" in p && !("summary" in p)) return p;
  const pl = p as Plan;
  const [row] = await getDb()<{ id: string; expires_at: Date }[]>`
    insert into assistant_action (organization_id, member_id, kind, payload, summary)
    values (${ctx.organizationId}, ${ctx.memberId}, ${pl.kind}, ${getDb().json(pl.payload)}, ${pl.summary}) returning id, expires_at`;
  return {
    kind: "proposal",
    text: c.op === "delete" ? "Please check before I go ahead. Nothing has been changed yet." : "Here's what I'll do. Nothing has been changed yet.",
    proposal: { id: row.id, verb: c.op, title: pl.title, fields: pl.fields, expiresAt: row.expires_at.toISOString() },
  };
}

async function claim(ctx: OrgContext, id: string, status: "done" | "cancelled") {
  if (!isUuid(id)) throw new NotFoundError("That request isn't available any more.");
  const [row] = await getDb()<{ kind: string; payload: Payload; summary: string }[]>`
    update assistant_action set status = ${status}, resolved_at = now()
    where id = ${id} and organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and status = 'pending' and expires_at > now()
    returning kind, payload, summary`;
  if (!row) throw new ConflictError("That request has expired or was already handled. Ask me again.");
  return row;
}

export async function cancelCommand(ctx: OrgContext, id: string): Promise<void> {
  await claim(ctx, id, "cancelled");
}

/** Runs a confirmed proposal once, as the person, through the normal services. */
export async function confirmCommand(ctx: OrgContext, id: string): Promise<{ text: string; href: string | null }> {
  const { kind, payload: p, summary } = await claim(ctx, id, "done");
  const base = `/${ctx.organization.slug}`;
  const s = (k: string) => (p[k] === null || p[k] === undefined ? null : String(p[k]));
  try {
    switch (kind) {
      case "create_lead": { await createLead(ctx, { fullName: s("fullName"), email: s("email"), companyName: s("companyName") }); return { text: `Done: the lead ${s("fullName")} is in the CRM.`, href: `${base}/crm/leads?q=${encodeURIComponent(s("fullName") ?? "")}`}; }
      case "create_company": { const r = await createCompany(ctx, { name: s("name") }); return { text: `Done: ${s("name")} was added to companies.`, href: `${base}/crm/companies/${r.id}` }; }
      case "create_project": { const r = await createProject(ctx, { name: s("name") }); return { text: `Done: the project ${s("name")} has started.`, href: `${base}/projects/${r.id}` }; }
      case "create_task": { const r = await createTask(ctx, s("projectId")!, { title: s("title") }); return { text: `Done: “${s("title")}” is in To do.`, href: `${base}/projects/${s("projectId")}/tasks/${r.id}` }; }
      case "create_vendor": { await createVendor(ctx, { name: s("name") }); return { text: `Done: ${s("name")} was added to vendors.`, href: `${base}/finance/vendors` }; }
      case "create_department": { await createDepartment(ctx, { name: s("name") }); return { text: `Done: the ${s("name")} department was created.`, href: `${base}/people/departments` }; }
      case "create_expense": { await createExpense(ctx, { description: s("description"), amount: p.amount, category: s("category"), spentOn: s("spentOn") }); return { text: `Done: the expense is waiting for approval.`, href: `${base}/finance/expenses` }; }
      case "create_invitation": { const r = await createInvitation(ctx, { email: s("email"), roleId: s("roleId") }); return { text: r.delivered ? `Done: the invitation was emailed to ${s("email")}.` : `Done: the invitation for ${s("email")} is ready. Copy its link from Members to send it.`, href: `${base}/settings/members` }; }
      case "create_time": { await createEntry(ctx, { workDate: s("workDate"), duration: `${Number(p.duration)}m`, projectId: s("projectId"), taskId: s("taskId"), description: s("description") }); return { text: `Done: ${formatMinutes(Number(p.duration))} h logged.`, href: `${base}/time` }; }
      case "start_timer": { await startTimer(ctx, { projectId: s("projectId"), taskId: s("taskId"), description: s("description") }); return { text: "Done: your timer is running.", href: `${base}/time` }; }
      case "stop_timer": { const r = await stopTimer(ctx); return { text: `Done: ${formatMinutes(r.minutes)} h saved.`, href: `${base}/time` }; }
      case "archive_lead": await setLeadArchived(ctx, s("id")!, true); return { text: `Done: ${summary.replace(/^archive lead /, "")} was archived. You can restore it from the archived leads.`, href: `${base}/crm/leads` };
      case "archive_company": await setCompanyArchived(ctx, s("id")!, true); return { text: "Done: the company was archived.", href: `${base}/crm/companies` };
      case "archive_project": await setProjectArchived(ctx, s("id")!, true); return { text: "Done: the project was archived.", href: `${base}/projects` };
      case "delete_task": await deleteTask(ctx, s("id")!); return { text: "Done: the task was deleted.", href: null };
      case "archive_vendor": await setVendorArchived(ctx, s("id")!, true); return { text: "Done: the vendor was archived.", href: `${base}/finance/vendors` };
      case "delete_department": await deleteDepartment(ctx, s("id")!); return { text: "Done: the department was deleted.", href: `${base}/people/departments` };
      case "delete_expense": await deleteExpense(ctx, s("id")!); return { text: "Done: the expense was deleted.", href: `${base}/finance/expenses` };
      case "delete_document": { const r = await deleteDocument(ctx, s("id")!); return { text: `Done: the ${r.kind} was deleted.`, href: `${base}/finance/${r.kind === "invoice" ? "invoices" : "estimates"}` }; }
      case "revoke_invitation": await revokeInvitation(ctx, s("id")!); return { text: "Done: the invitation was cancelled.", href: `${base}/settings/members` };
    }
    throw new ConflictError("I can't do that from chat yet.");
  } catch (e) {
    await getDb()`update assistant_action set status = 'failed' where id = ${id}`;
    throw e;
  }
}

/** Latest proposal still waiting for this person (so "yes" / "haan" can answer it). */
export async function latestPendingCommand(ctx: OrgContext): Promise<string | null> {
  const [row] = await getDb()<{ id: string }[]>`
    select id from assistant_action where organization_id = ${ctx.organizationId} and member_id = ${ctx.memberId} and status = 'pending' and expires_at > now()
    order by created_at desc limit 1`;
  return row?.id ?? null;
}

