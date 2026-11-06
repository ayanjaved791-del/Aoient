# Aoient

**One Platform. Your Entire Business.** — a multi-tenant Business Operating System for agencies, software studios and consultancies.

Built from the *Aoient Master Technical Specification V2*. Delivery follows the milestone plan in [`docs/ROADMAP.md`](docs/ROADMAP.md).

| Status | Milestone |
| --- | --- |
| ✅ | **M0** — repository baseline, architecture, design tokens |
| ✅ | **M1** — authentication, organizations, memberships, invitations, roles & permissions |
| ⏳ | M2 — application shell, dashboard, settings, notifications |
| — | M3–M9 — see roadmap |

## Quick start

Aoient runs on **Supabase** (Auth + Postgres).

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env` and fill in the Supabase values (Project URL, publishable key, database connection string) and `APP_URL`.
3. In Supabase → Authentication → URL Configuration, set the Site URL and add `<APP_URL>/auth/confirm` to Redirect URLs.

```bash
npm install
npm run db:migrate            # creates the tables in your Supabase database
npm run db:seed               # permission catalogue + system roles
npm run doctor                # checks settings, connection, migrations, seed
npm run dev
```

Sign-up verification and password-reset emails are sent by Supabase. Invitation emails are printed to the server log until an email provider is configured. Details: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit + integration tests (needs a local Postgres in `TEST_DATABASE_URL`) |
| `npm run db:migrate` · `db:seed` | Apply `supabase/migrations/*.sql` · sync permissions and system roles |
| `npm run doctor` | Checks `.env`, Supabase settings, database connection, migrations and seed; prints the fix for anything missing |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — structure, decisions, request lifecycle
- [Database](docs/DATABASE.md) — schema conventions and tenancy rules
- [Security](docs/SECURITY.md) — controls implemented and known gaps
- [API](docs/API.md) — `/api/v1` contract
- [Development](docs/DEVELOPMENT.md) — setup, testing, conventions
- [Roadmap](docs/ROADMAP.md) — milestones and status
