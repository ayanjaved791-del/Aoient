# Architecture

Aoient is a **modular monolith**: one Next.js application, one Supabase (PostgreSQL) database, with strict internal module boundaries.

## Stack (pinned)

| Concern | Choice | Version |
| --- | --- | --- |
| Framework | Next.js App Router, React, TypeScript | 16.4.5 / 19.3 / 5.9 |
| Styling | Tailwind CSS v4, shadcn/ui-pattern components on Radix primitives, Lucide | 4.3 |
| Data | Supabase Postgres, plain SQL via the `postgres` driver; migrations in `supabase/migrations` | postgres 3.4.9 |
| Auth | Supabase Auth via `@supabase/ssr` (email + password, verification, reset, cookie sessions) | supabase-js 2.118 / ssr 0.12.7 |
| Validation / forms | Zod 4, React Hook Form | |
| Tests | Vitest (unit + integration on real Postgres), Playwright (E2E) | |

## Folder structure

```
supabase/migrations/    SQL schema (tables, triggers, RLS lock-down)
scripts/                migrate, seed (reference data only), doctor
src/
  app/                  routes only — thin; no business logic
    (auth)/             sign-in, sign-up, verify-email, forgot/reset-password
    [organizationSlug]/ tenant workspace (every page re-verifies membership)
    organizations/      org picker + onboarding
    invite/[token]/     invitation acceptance
    auth/confirm/       Supabase email-link landing (verification, password reset)
    pricing/            plans + Paddle checkout
    api/v1/             versioned JSON API (spec §15)
  components/
    ui/                 design-system primitives (Button, Field, Dialog, …)
    layout/             shell pieces (org switcher, user menu, page header)
    providers/
  modules/<module>/     module UI: client components + server actions
  server/               all server-only code ("import 'server-only'")
    auth/               Supabase server client + session Data Access Layer
    tenancy/            resolveOrgContext — the tenant boundary
    permissions/        catalogue, system roles, pure evaluator, DB sync
    organizations/      domain services (orgs, members, invitations, roles)
    audit/ email/ rate-limit/ database/ api/ actions/
  lib/                  isomorphic helpers: validation, errors, tokens, formatting
tests/unit · tests/integration · tests/e2e
```

Rule: `app/` and `modules/` call **services in `server/`**; services own validation, authorization, transactions and audit. Business logic never lives in React components.

## Request lifecycle (spec §3 evaluation order)

1. **Proxy** (`src/proxy.ts`) — refreshes the Supabase session cookies and redirects signed-out visitors to sign-in. *Not* a security boundary.
2. **Authenticate** — `getSessionUser()` verifies the Supabase session (`getClaims`), then loads the `profile` row and rejects deactivated users.
3. **Resolve tenant** — `resolveOrgContext(userId, { slug | id })` proves active membership in an active organization and loads the role's permissions. Foreign and non-existent organizations raise the *same* `NotFoundError`.
4. **Authorize** — services call `assertPermission(ctx, key)`; mutations that grant access also run escalation checks (`canGrantRole`, `canActOnMember`).
5. **Execute** — every query is scoped by `ctx.organizationId`; multi-step changes run in a transaction.
6. **Audit** — sensitive changes write an `audit_log` row in the same transaction.

Server actions, API route handlers and pages all pass through steps 2–6; none trusts an organization id from the browser.

## Key decisions

| # | Decision | Why |
| --- | --- | --- |
| ADR-1 | **Supabase Auth for identity only; tenancy & RBAC are ours.** (Replaced Better Auth.) | Product owner chose Supabase. It handles password hashing, sessions, verification and reset emails, and auth rate limits. Custom roles, the permission catalogue and escalation rules remain core product logic that we test and evolve directly (spec §3). |
| ADR-2 | **Path-based tenancy** (`/{organizationSlug}/…`). | Explicit, bookmarkable, works with multiple tabs in different orgs; switching is plain navigation re-verified on the server. Slugs exclude a reserved list. |
| ADR-3 | **System roles are global rows** (`organizationId = null`); custom roles belong to one org. | System roles stay consistent and are re-synced from code on deploy. A custom role id from another tenant resolves to *not found*. |
| ADR-4 | **Owner/Admin are data, not special cases.** Owner holds every permission; Admin holds all but `billing.manage`. Only owners can grant Owner; nobody can grant permissions they lack; ≥1 active owner is enforced under a row lock. | Removes hidden bypasses; makes escalation rules testable. |
| ADR-5 | **Keep `cacheComponents` enabled** (Next 16 default; slated to become mandatory). | Tenant data is never wrapped in `use cache`, so it is always request-scoped. Session/params reads sit inside `<Suspense>`; static chrome is prerendered. |
| ADR-6 | **No ORM: plain parameterised SQL with `postgres`; Supabase's Data API is not used for app data.** (Replaced Prisma.) | Product owner asked to remove Prisma. Invitations, membership changes and the last-owner rule need real transactions and row locks, which supabase-js cannot express; a direct connection can. RLS with no policies blocks the browser key entirely. |
| ADR-7 | **UUID primary keys** (`gen_random_uuid()`). | Non-guessable; matches Supabase's `auth.users` ids. |
| ADR-8 | **shadcn/ui-pattern components authored in-repo** (Radix + CVA + Tailwind). | The shadcn registry was unreachable from the build environment; the components follow its structure and can be diffed against upstream later. |
| ADR-9 | **Email provider interface** with a console adapter. | No paid service required to develop; the UI states when an email was *not* delivered externally. |
| ADR-10 | ~~Browser-only accounts~~ — superseded by Supabase Auth (ADR-1). | Was a stop-gap until a database existed. |
| ADR-12 | **Light theme by default, not following the OS.** Dark remains a manual choice in the user menu; the "System" option was removed. | Product owner request. |
| ADR-11 | **No storage quotas in plans; no file-storage subsystem yet.** | Product owner request: storage removed from pricing and the system. Revisit if Documents (M5) needs file uploads. |

## Known limitations (current)


- Streaming pages return HTTP 200 with the not-found UI when an org is not accessible (headers are sent before membership resolves). The JSON API returns a real 404. Content is identical for foreign and missing orgs.
- No real email delivery yet (console provider only).
- MFA is not implemented and is not claimed.
