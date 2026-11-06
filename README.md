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

### Setting up from the browser (Vercel + Supabase, no terminal)

1. **Vercel → your project → Settings → Environment Variables.** If you connected Supabase through Vercel's Supabase integration, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `POSTGRES_URL` are already there, and Aoient uses them as they are. Otherwise add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `DATABASE_URL` (transaction pooler, port 6543) by hand. Optionally set `APP_URL` to your site address; without it, the Vercel production domain is used.
2. **Database tables are created automatically.** Every *production* deploy on Vercel first applies any new `supabase/migrations` and syncs the permission catalogue (`scripts/deploy-db.ts`, run by `npm run build`), using `POSTGRES_URL_NON_POOLING` / `DATABASE_URL`. Preview deployments never change the database. If a database update fails, the deploy stops and the previous version stays live; the build log says why. Manual fallback: paste [`supabase/setup.sql`](supabase/setup.sql) into **Supabase → SQL Editor** and click **Run** (safe to repeat; both ways share the same record of what's applied). Check the result any time at `/api/health`.
3. **Supabase → Authentication → URL Configuration:** Site URL = your site address; add `<site>/auth/confirm` to Redirect URLs.
4. Redeploy on Vercel.

If you have more than one Supabase project, steps 2 and 3 must be done in the one whose URL is in Vercel's `NEXT_PUBLIC_SUPABASE_URL`.

### Paddle (plans and licenses)

Every new workspace gets a 14-day Medisea trial. Paid plans are activated only by Paddle webhooks:

1. Vercel: `PADDLE_API_KEY` (Secret), `NEXT_PUBLIC_PADDLE_ENVIRONMENT`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` and the six `NEXT_PUBLIC_PADDLE_PRICE_*` IDs (Config).
2. Paddle → Developer tools → Notifications → **New destination**: URL `https://<your site>/api/webhooks/paddle`, events `subscription.*`. Copy its secret key into Vercel as `PADDLE_WEBHOOK_SECRET` (Secret) and redeploy.

Sign-up verification and password-reset emails are sent by Supabase. Invitation emails are printed to the server log until an email provider is configured. Details: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit + integration tests (needs a local Postgres in `TEST_DATABASE_URL`) |
| `npm run db:migrate` · `db:seed` | Apply `supabase/migrations/*.sql` · sync permissions and system roles |
| `npm run db:deploy` | What production builds run first: migrations + permission sync, only when `VERCEL_ENV=production` |
| `npm run db:setup-sql` | Regenerate `supabase/setup.sql` (migrations + seed in one file for the Supabase SQL Editor) |
| `npm run doctor` | Checks `.env`, Supabase settings, database connection, migrations and seed; prints the fix for anything missing |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — structure, decisions, request lifecycle
- [Database](docs/DATABASE.md) — schema conventions and tenancy rules
- [Security](docs/SECURITY.md) — controls implemented and known gaps
- [API](docs/API.md) — `/api/v1` contract
- [Development](docs/DEVELOPMENT.md) — setup, testing, conventions
- [Roadmap](docs/ROADMAP.md) — milestones and status
