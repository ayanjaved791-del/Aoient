/**
 * Controlled permission catalogue (spec §3).
 *
 * This file is the single source of truth. `syncPermissionCatalog` mirrors it into
 * the `permission` table and keeps system roles' grants up to date.
 *
 * `released` marks modules whose features exist in the product today. The role
 * editor shows unreleased modules as "not yet available" so admins can see what a
 * role will cover without the UI implying those features work already.
 *
 * NOTE: pure module — no `server-only` import so unit tests and the seed script can use it.
 */

export type ModuleKey =
  | "organization"
  | "billing"
  | "people"
  | "crm"
  | "projects"
  | "time"
  | "finance"
  | "flow"
  | "analytics"
  | "documents"
  | "inventory"
  | "workspace"
  | "connect";

export const MODULES: Record<ModuleKey, { label: string; released: boolean }> = {
  organization: { label: "Organization & access", released: true },
  billing: { label: "Billing & subscription", released: true },
  people: { label: "People", released: true },
  crm: { label: "CRM", released: true },
  projects: { label: "Projects", released: true },
  time: { label: "Time", released: true },
  finance: { label: "Finance", released: true },
  flow: { label: "Flow", released: false },
  analytics: { label: "Analytics", released: false },
  documents: { label: "Documents", released: false },
  inventory: { label: "Inventory", released: true },
  workspace: { label: "Workspace", released: false },
  connect: { label: "Connect", released: false },
};

const def = <K extends string>(key: K, module: ModuleKey, description: string) => ({ key, module, description });

export const PERMISSIONS = [
  // Organization & access
  def("organization.read", "organization", "View organization profile and settings"),
  def("organization.update", "organization", "Edit organization profile and settings"),
  def("organization.members.read", "organization", "View members and their roles"),
  def("organization.members.invite", "organization", "Invite people to the organization"),
  def("organization.members.manage", "organization", "Change member roles and suspend members"),
  def("organization.members.remove", "organization", "Remove members from the organization"),
  def("organization.roles.manage", "organization", "Create and edit custom roles"),
  def("organization.audit.read", "organization", "View security and audit logs"),
  // Billing
  def("billing.read", "billing", "View subscription and billing history"),
  def("billing.manage", "billing", "Change plan, payment method and cancel subscription"),
  // People
  def("people.employee.read", "people", "View employee directory"),
  def("people.employee.create", "people", "Add employees"),
  def("people.employee.update", "people", "Edit employee records"),
  def("people.employee.archive", "people", "Archive employees"),
  def("people.employee.sensitive.read", "people", "View salary and emergency contact data"),
  def("people.department.manage", "people", "Manage departments and designations"),
  def("people.attendance.own", "people", "Check in and out for yourself"),
  def("people.attendance.manage", "people", "Manage attendance and corrections"),
  def("people.leave.request", "people", "Request leave for yourself"),
  def("people.leave.approve", "people", "Approve or reject leave requests"),
  def("people.onboarding.manage", "people", "Manage onboarding checklists"),
  def("people.payroll.read", "people", "View payroll records"),
  def("people.payroll.manage", "people", "Edit payroll records"),
  // CRM
  def("crm.lead.read", "crm", "View leads"),
  def("crm.lead.create", "crm", "Create leads"),
  def("crm.lead.update", "crm", "Edit, assign, qualify and convert leads"),
  def("crm.lead.archive", "crm", "Archive leads"),
  def("crm.contact.read", "crm", "View contacts and companies"),
  def("crm.contact.manage", "crm", "Create and edit contacts and companies"),
  def("crm.deal.read", "crm", "View deals"),
  def("crm.deal.create", "crm", "Create deals"),
  def("crm.deal.update", "crm", "Edit deals and move stages"),
  def("crm.pipeline.manage", "crm", "Configure pipelines and stages"),
  def("crm.report.read", "crm", "View sales reports"),
  // Projects
  def("projects.project.read", "projects", "View projects"),
  def("projects.project.create", "projects", "Create projects"),
  def("projects.project.update", "projects", "Edit projects, members and milestones"),
  def("projects.project.archive", "projects", "Archive projects"),
  def("projects.task.read", "projects", "View tasks"),
  def("projects.task.create", "projects", "Create tasks"),
  def("projects.task.update", "projects", "Edit any task"),
  def("projects.task.assign", "projects", "Assign tasks to members"),
  // Time
  def("time.entry.own", "time", "Track and edit your own time"),
  def("time.entry.read_all", "time", "View everyone's time entries"),
  def("time.timesheet.approve", "time", "Approve submitted timesheets"),
  // Finance
  def("finance.invoice.read", "finance", "View invoices and estimates"),
  def("finance.invoice.create", "finance", "Create and edit draft invoices and estimates"),
  def("finance.invoice.issue", "finance", "Issue and void invoices"),
  def("finance.payment.record", "finance", "Record payments"),
  def("finance.expense.read", "finance", "View expenses"),
  def("finance.expense.manage", "finance", "Create and edit expenses"),
  def("finance.expense.approve", "finance", "Approve expenses"),
  def("finance.vendor.manage", "finance", "Manage vendors and their payment details"),
  def("finance.report.read", "finance", "View finance reports and budgets"),
  // Flow
  def("flow.workflow.read", "flow", "View workflows and run history"),
  def("flow.workflow.manage", "flow", "Create, edit and enable workflows"),
  // Analytics
  def("analytics.read", "analytics", "View analytics dashboards and export reports"),
  // Documents
  def("documents.read", "documents", "View documents shared with you"),
  def("documents.upload", "documents", "Upload documents"),
  def("documents.manage", "documents", "Manage folders, sharing and approvals"),
  // Inventory
  def("inventory.read", "inventory", "View products and stock"),
  def("inventory.manage", "inventory", "Record stock movements and manage products"),
  // Workspace
  def("workspace.use", "workspace", "Use messages, channels and calendar"),
  def("workspace.announcement.manage", "workspace", "Publish announcements"),
  // Connect
  def("connect.apikey.manage", "connect", "Create and revoke API keys"),
  def("connect.webhook.manage", "connect", "Configure outgoing webhooks and integrations"),
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

/**
 * Permissions in a released module whose feature isn't built yet. They can be
 * granted ahead of time, but the UI marks them "coming soon" and never implies
 * they do anything today.
 */
export const NOT_YET_AVAILABLE: ReadonlySet<string> = new Set([
  "people.onboarding.manage",
  "people.payroll.read",
  "people.payroll.manage",
]);

/** True when the feature behind a permission exists in the product today. */
export function isPermissionLive(key: string): boolean {
  const p = PERMISSIONS.find((x) => x.key === key);
  return Boolean(p && MODULES[p.module].released && !NOT_YET_AVAILABLE.has(key));
}

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);

const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(ALL_PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

// ───────────────────────────── System roles ─────────────────────────────

export type SystemRoleKey =
  | "owner"
  | "admin"
  | "hr_manager"
  | "sales_manager"
  | "project_manager"
  | "finance_manager"
  | "employee"
  | "guest";

export const OWNER_ROLE_KEY: SystemRoleKey = "owner";
export const DEFAULT_INVITE_ROLE_KEY: SystemRoleKey = "employee";

const byModule = (...modules: ModuleKey[]) =>
  ALL_PERMISSION_KEYS.filter((k) => modules.includes(PERMISSIONS.find((p) => p.key === k)!.module));

/** Baseline every internal member gets. */
const EMPLOYEE_BASE: PermissionKey[] = [
  "organization.read",
  "people.employee.read",
  "people.leave.request",
  "people.attendance.own",
  "projects.project.read",
  "projects.task.read",
  "projects.task.create",
  "time.entry.own",
  "documents.read",
  "documents.upload",
  "workspace.use",
];

export const SYSTEM_ROLES: Record<SystemRoleKey, { name: string; description: string; permissions: readonly PermissionKey[] }> = {
  owner: {
    name: "Owner",
    description: "Full access including billing, data export and ownership.",
    permissions: ALL_PERMISSION_KEYS,
  },
  admin: {
    name: "Admin",
    description: "Manages members, settings and all modules. Billing is view-only unless granted separately.",
    permissions: ALL_PERMISSION_KEYS.filter((k) => k !== "billing.manage"),
  },
  hr_manager: {
    name: "HR Manager",
    description: "Manages employee records, leave, attendance and onboarding.",
    // Sees members so employee records can be matched to logins.
    permissions: [...new Set<PermissionKey>([...EMPLOYEE_BASE, ...byModule("people"), "organization.members.read"])],
  },
  sales_manager: {
    name: "Sales Manager",
    description: "Manages the CRM pipeline, leads, contacts, deals and sales reports.",
    permissions: [...new Set<PermissionKey>([...EMPLOYEE_BASE, ...byModule("crm"), "projects.project.create"])],
  },
  project_manager: {
    name: "Project Manager",
    description: "Manages projects, tasks, milestones, team workload and timesheet approval.",
    permissions: [
      ...new Set<PermissionKey>([
        ...EMPLOYEE_BASE,
        ...byModule("projects"),
        "time.entry.read_all",
        "time.timesheet.approve",
        "crm.contact.read",
        "crm.deal.read",
      ]),
    ],
  },
  finance_manager: {
    name: "Finance Manager",
    description: "Manages invoices, expenses, payments, vendors, inventory and finance reports.",
    permissions: [
      ...new Set<PermissionKey>([
        ...EMPLOYEE_BASE,
        ...byModule("finance"),
        ...byModule("inventory"),
        "time.entry.read_all",
        "crm.contact.read",
        "crm.deal.read",
        "billing.read",
        "people.payroll.read",
      ]),
    ],
  },
  employee: {
    name: "Employee",
    description: "Views own profile, requests leave, tracks own time and works on assigned tasks.",
    permissions: EMPLOYEE_BASE,
  },
  guest: {
    name: "Client / Guest",
    description: "Restricted external access. Sees only explicitly shared items (client portal arrives in a later release).",
    permissions: [],
  },
};

export const SYSTEM_ROLE_KEYS = Object.keys(SYSTEM_ROLES) as SystemRoleKey[];
