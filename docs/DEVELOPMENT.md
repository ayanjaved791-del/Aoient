# Development

## Prerequisites

Node.js 22+, PostgreSQL 16 with two databases (dev and test — the test DB is wiped by the suite).

```bash
createdb aoient_dev && createdb aoient_test
cp .env.example .env
# set DATABASE_URL, TEST_DATABASE_URL, APP_URL, BETTER_AUTH_URL
# BETTER_AUTH_SECRET: openssl rand -base64 32
npm install && npm run db:migrate && npm run db:seed && npm run dev
```

## Email in development

`EMAIL_PROVIDER=console` prints verification, reset and invitation emails (with their links) to the server log. Nothing is sent externally, and the invite UI says so.

## Quality gates (run before every commit / milestone)

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- **Unit** (`tests/unit`): permission catalogue & evaluator, validation, tokens.
- **Integration** (`tests/integration`): real Postgres — tenant isolation (service + HTTP layer), RBAC & escalation, invitation lifecycle, concurrency.
- **E2E** (`tests/e2e`): Playwright browser flow; see the header of `m1-identity-flow.mjs`.

## Conventions

- Business logic lives in `src/server/**` services that take an `OrgContext`; UI calls them via server actions in `src/modules/**/actions.ts` or `/api/v1` routes.
- New tenant table → add `organizationId` + index, scope every query with `ctx.organizationId`, add a cross-tenant test.
- New permission → add it to `src/server/permissions/catalog.ts` (and to system roles as appropriate), then `npm run db:seed`.
- Under Cache Components, anything that reads the session, `params` or `searchParams` must render inside `<Suspense>`. Never put tenant data behind `use cache`.
- Never commit `.env` or secrets.
