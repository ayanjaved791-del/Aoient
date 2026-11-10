# Database

Supabase (managed PostgreSQL). Schema changes are plain SQL files in `supabase/migrations/`, compatible with the Supabase CLI (`supabase db push`) and applied by `npm run db:migrate` without it. The server queries the database directly with the [`postgres`](https://github.com/porsager/postgres) driver (tagged-template SQL, always parameterised). There is no ORM.

## Access model

- **Identity** lives in Supabase Auth (`auth.users`). A trigger in the migration mirrors each user into `public.profile` (name, lower-cased email, `email_verified`, `status`).
- **App data** is read and written only by the Next.js server through `DATABASE_URL`, which enforces tenancy and RBAC itself (`src/server/tenancy`, `src/server/permissions`).
- **Row Level Security is enabled on every table with no policies.** The public Supabase key in the browser (roles `anon` / `authenticated`) therefore cannot read or change any app data through Supabase's Data API. A test asserts this for every table (`tests/integration/tenant-isolation.test.ts`).

## Conventions

- **IDs:** UUIDs (`gen_random_uuid()`). Non-UUID IDs in requests are treated as *not found* before they reach SQL.
- **Columns:** `snake_case`; services map rows to camelCase objects.
- **Tenancy:** every tenant-owned table has a direct, indexed `organization_id`. Queries filter by the value from a verified `OrgContext`, never from request input.
- **Timestamps:** `timestamptz` (`created_at` / `updated_at`).
- **Lifecycle:** explicit enums (`organization_status`, `member_status`, `invitation_status`, `user_status`).
- **Transactions:** `transaction()` from `src/server/database/client.ts`; membership changes lock the organization row (`for update`) to protect the last-owner rule.
- **Money / quantities (future modules):** `numeric` for currency, integers for durations (seconds) and stock.
- **Deletion:** membership removal is a hard delete (history lives in the audit log); business records will be archived/soft-deleted.
- **Migrations:** add a new timestamped file to `supabase/migrations/`; never edit one that has been applied. Applied files are recorded in `public.schema_migration`.

## Current tables

| Table | Notes |
| --- | --- |
| `profile` | 1:1 with `auth.users` (cascade delete), kept in sync by trigger. `status = deactivated` signs the user out of Aoient. |
| `rate_limit_bucket` | App-level fixed-window limiter (invitations, org creation, accept). |
| `organization` | Tenant root: name, unique slug, timezone, currency, status. |
| `organization_member` | Unique `(organization_id, user_id)`; role + status. |
| `role` | System roles (`organization_id` NULL, partial unique index on `key`) or org custom roles (unique `(organization_id, key)`). |
| `permission`, `role_permission` | Controlled catalogue mirrored from `src/server/permissions/catalog.ts`. |
| `invitation` | Stores only `token_hash` (SHA-256). Partial unique index: one pending invitation per `(organization_id, lower(email))`. |
| `audit_log` | Actor, action, target, source, correlation id, sanitised metadata. |
| `crm_company`, `crm_contact`, `crm_lead`, `crm_deal` | CRM records. Links between them (and to the record owner in `organization_member`) are composite `(organization_id, id)` foreign keys, so the database refuses a link to another organization's row. Archived with `archived_at`, never deleted. |
| `crm_stage` | The organization's pipeline: ordered stages of kind `open`, `won` or `lost` with a win probability. Six default stages are created the first time the CRM is used. A deal in a won/lost stage has `closed_at` set. |
| `project`, `project_member` | Projects with a status, optional client (`crm_company`) and source deal (`crm_deal`, one project per deal), a lead and a team. People without `projects.project.update` only see projects they're a member of. |
| `project_milestone`, `project_task`, `project_task_comment` | Milestones, tasks (status, priority, assignee from the team, due date, board position) and task comments. All links are composite `(organization_id, id)` foreign keys. |
| `finance_vendor` | Suppliers the organization pays. Name unique per organization. |
| `finance_document`, `finance_document_line` | Invoices and estimates (`kind`), numbered per organization and kind (INV-0001, EST-0001). Totals are computed on the server from the lines. Issued invoices are fixed; an accepted estimate becomes at most one invoice (`converted_from_id`). Optional links to `crm_company` and `project` via composite keys. |
| `finance_payment` | Money a client paid against an issued invoice (bookkeeping only; Aoient moves no money). `amount_paid` can never exceed `total`. |
| `finance_template` | One row per organization: layout, colour, logo, business details, titles, footer and defaults (due days, tax rate, notes) used on invoices, estimates and receipts. Edited in Finance → Editor (`finance.invoice.issue`). |
| `time_entry` | Time a member worked: day, minutes (null while a timer runs; at most one running timer per person), optional project and task (composite keys), billable flag, and the invoice it was billed on (`on delete set null`, so deleting a draft frees the hours). |
| `time_timesheet` | A member's week (Monday start): submitted → approved / rejected. Submitted or approved weeks lock their entries. |
| `finance_expense` | Spending with a pending → approved/rejected → paid flow, optional vendor and project. Nobody but the owner approves their own expense. |
| `profile.email_unproven` | Set when the server created a login because Supabase couldn't send the confirmation email. Such a login can sign in and create its own workspace, but `email_verified` stays false. |
| `crm_note` | Notes on a lead, contact, company or deal (`subject_type`, `subject_id`); the server checks the subject belongs to the same organization. Audit entries record that a note was added, never its words. |

## Seed

`npm run db:seed` synchronises the permission catalogue and system roles. It is idempotent and safe on every deploy. It creates **no** business or demo data.

## Tests

The integration suite runs on a **plain local Postgres** database (`TEST_DATABASE_URL`), never on the Supabase project. `tests/support/auth-stub.sql` provides a minimal stand-in for Supabase's `auth.users` table and API roles so the real migration and its RLS can be exercised.

## Licenses (M8)

| Table | Notes |
| --- | --- |
| `organization_license` | One row per organization: plan, interval, status (`trialing`/`active`/`past_due`/`paused`/`canceled`), source (`trial` or `paddle`), trial and period end dates, Paddle subscription/customer IDs and the time of the last applied Paddle event. Written only by the server: a 14-day Medisea trial when the organization is created, then verified webhooks. |
| `paddle_webhook_event` | Every Paddle event ID once (idempotency) with its outcome. |

What a state allows lives in `src/lib/billing/entitlements.ts`: trial/active/past-due/canceling = full access within the plan's limits; expired = read-only (data stays visible; removing members and revoking invitations still work).
