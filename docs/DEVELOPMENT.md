# Development

## Prerequisites

Node.js 22+, a Supabase project, and a local PostgreSQL 16 database for the test suite (it is wiped on every run; the test user must be able to create roles).

```bash
cp .env.example .env
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, DATABASE_URL (Supabase), APP_URL
# TEST_DATABASE_URL (local Postgres)
npm install && npm run db:migrate && npm run db:seed && npm run doctor && npm run dev
```

On Vercel, production deploys apply new migrations and the permission sync automatically before building (`scripts/deploy-db.ts`; skipped for previews and local builds, or with `AOIENT_SKIP_DB_MIGRATIONS=1`). Migrations take a Postgres advisory lock, so overlapping deploys apply each file once. No terminal and no deploy? Paste `supabase/setup.sql` into Supabase → SQL Editor instead (see the README). After adding a migration or changing the permission catalogue, run `npm run db:setup-sql` — a unit test fails if the file is stale.

### Supabase dashboard settings

- **Authentication → URL Configuration:** Site URL = your `APP_URL`; add `<APP_URL>/auth/confirm` to Redirect URLs (and `http://localhost:3000/auth/confirm` for local dev).
- **Authentication → Sign In / Providers → Email:** keep *Confirm email* on.
- **Recommended email templates** (work when the link is opened on another device): in *Confirm signup* use
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}` and in *Reset password*
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. The default templates also work in the same browser.
- Supabase's built-in email sender is rate-limited and meant for testing; add custom SMTP before launch.

## Email in development

Verification and password-reset emails are sent by Supabase Auth. Invitation emails use `EMAIL_PROVIDER=console`, which prints them (with their links) to the server log — nothing is sent externally, and the invite UI says so.

## Quality gates (run before every commit / milestone)

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- **Unit** (`tests/unit`): permission catalogue & evaluator, validation, tokens.
- **Integration** (`tests/integration`): real Postgres — tenant isolation (service + HTTP layer), RBAC & escalation, invitation lifecycle, concurrency.
- **E2E:** to be rebuilt against a Supabase project (the previous script targeted the removed Better Auth flows).

## Conventions

- Business logic lives in `src/server/**` services that take an `OrgContext`; UI calls them via server actions in `src/modules/**/actions.ts` or `/api/v1` routes.
- New tenant table → add `organizationId` + index, scope every query with `ctx.organizationId`, add a cross-tenant test.
- New permission → add it to `src/server/permissions/catalog.ts` (and to system roles as appropriate), then `npm run db:seed`.
- New table → new file in `supabase/migrations/`, and `alter table … enable row level security;` (the RLS test fails otherwise).
- Under Cache Components, anything that reads the session, `params` or `searchParams` must render inside `<Suspense>`. Never put tenant data behind `use cache`.
- Never commit `.env` or secrets.
