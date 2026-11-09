# Roadmap

Milestones from spec §27. A milestone is complete only when its exit criteria pass.

| Milestone | Scope | Exit criteria | Status |
| --- | --- | --- | --- |
| M0 Repository readiness | Project setup, architecture decisions, design tokens | Clean baseline; install/build checks pass | ✅ Done |
| M1 Identity foundation | Auth, organizations, memberships, invitations, roles & permissions | Cross-tenant negative tests pass | ✅ Done |
| M2 Core workspace | App shell (grouped sidebar, search, create menu), dashboard, profile & sessions, notifications base, audit log viewer | Responsive shell with functional routes | Next |
| M3 Core operations | People, CRM, Projects, Time | Pilot business can use core workflow | ✅ People. ✅ CRM: leads (with conversion), contacts, companies, a drag-and-drop pipeline with editable stages, notes and sales reports. ✅ Projects: teams, drag-and-drop task boards, milestones, comments, My tasks, workload, and won deals turned into projects. Time next. |
| M4 Connected flow | Deal won → project → tasks → time → metrics | E2E flow verified | |
| M5 Operations add-ons | Flow, Analytics expansion, Documents | Auditable automation | |
| M6 Commercial modules | Finance, Inventory | Calculations verified | |
| M7 Ecosystem | Workspace, Connect (API keys, webhooks) | Provider lifecycle tested | |
| M8 Billing | Paddle Sandbox, subscription mapping, entitlements (no storage quotas in plans) | Billing test matrix passes | ✅ Licenses: 14-day trial, plan limits (users, admin seats, custom roles) enforced on the server, verified webhooks, billing page. Project/automation limits wait for those modules. |
| M9 Launch readiness | Security review, backups, privacy/legal docs, monitoring | Go/no-go signed off | |

## M1 delivered

- Email/password sign-up, verification, sign-in/out, password reset, account deactivation guard.
- Organization creation (creator = Owner), switching, settings (name, URL, timezone, currency), leave.
- Invitations: hashed single-use tokens, expiry, revoke, re-invite, email-bound acceptance.
- Members: search/filter, role changes, suspend/reactivate, remove — with escalation and last-owner protection.
- 8 system roles + custom roles over a 65-permission catalogue (unreleased modules labelled as such).
- Audit log for all of the above; DB-backed rate limiting; `/api/v1` organization endpoints.
- 42 unit/integration tests + browser E2E flow.

## Current mode

Accounts and data run on **Supabase**: Supabase Auth for sign-up/sign-in (verification and reset emails), Supabase Postgres for app data (plain SQL from the server; Row Level Security blocks the browser key). Signed-in users land on `/pricing` (Medisea $29 / Indiana $79 / Pacfic-DeepDive $169 per month, each also available yearly at 10 months' price, spec §28). "Buy now" opens Paddle's overlay checkout when the `NEXT_PUBLIC_PADDLE_*` settings are present, and otherwise explains which settings are missing. A completed browser checkout never unlocks anything: activation waits for a verified Paddle webhook (M8). File storage has been removed from the system and from planned pricing.
