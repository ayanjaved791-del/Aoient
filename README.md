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

```bash
cp .env.example .env          # fill in values (see docs/DEVELOPMENT.md)
npm install                   # also generates the Prisma client
npm run db:migrate            # apply migrations
npm run db:seed               # permission catalogue + system roles
npm run doctor                # checks env vars, database, migrations, seed
npm run dev
```

Emails (verification, password reset, invitations) are printed to the server log by the `console` provider until a real email provider is configured.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit + integration tests (needs `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Browser flow against a running server (see the script header) |
| `npm run db:migrate` · `db:deploy` · `db:seed` | Prisma |
| `npm run doctor` | Checks `.env`, database connection, migrations and seed; prints the fix for anything missing |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — structure, decisions, request lifecycle
- [Database](docs/DATABASE.md) — schema conventions and tenancy rules
- [Security](docs/SECURITY.md) — controls implemented and known gaps
- [API](docs/API.md) — `/api/v1` contract
- [Development](docs/DEVELOPMENT.md) — setup, testing, conventions
- [Roadmap](docs/ROADMAP.md) — milestones and status
