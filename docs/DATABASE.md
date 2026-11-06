# Database

PostgreSQL via Prisma 7 (`prisma/schema.prisma`, config in `prisma.config.ts`, client generated to `src/generated/prisma`).

## Conventions

- **IDs:** UUIDv7 strings (`@default(uuid(7))`).
- **Tenancy:** every tenant-owned table has a direct, indexed `organizationId`. Queries filter by the value from a verified `OrgContext`, never from request input.
- **Timestamps:** `createdAt` / `updatedAt` on mutable records; stored in UTC.
- **Lifecycle:** explicit enums (`OrganizationStatus`, `MemberStatus`, `InvitationStatus`, `UserStatus`).
- **Money / quantities (future modules):** `Decimal` for currency, integers for durations (seconds) and stock.
- **Deletion:** membership removal is a hard delete (history lives in the audit log); business records will be archived/soft-deleted.
- **Migrations:** `npm run db:migrate` in development, `npm run db:deploy` in production. Never reset a production database.

## Current tables (M1)

| Table | Notes |
| --- | --- |
| `user`, `session`, `account`, `verification` | Better Auth core schema; `user.status` adds account deactivation. |
| `rateLimit` | Better Auth rate-limit storage (DB-backed so limits hold across instances). |
| `rate_limit_bucket` | App-level fixed-window limiter (invitations, org creation, accept). |
| `organization` | Tenant root: name, unique slug, timezone, currency, status. |
| `organization_member` | Unique `(organizationId, userId)`; role + status. |
| `role` | System roles (`organizationId` NULL, partial unique index on `key`) or org custom roles (unique `(organizationId, key)`). |
| `permission`, `role_permission` | Controlled catalogue mirrored from `src/server/permissions/catalog.ts`. |
| `invitation` | Stores only `tokenHash` (SHA-256). Partial unique index: one pending invitation per `(organizationId, lower(email))`. |
| `audit_log` | Actor, action, target, source, correlation id, sanitized metadata. |

Hand-written SQL in `prisma/migrations/*_init/migration.sql` adds the two partial unique indexes Prisma cannot express.

## Seed

`npm run db:seed` synchronises the permission catalogue and system roles. It is idempotent and safe on every deploy. It creates **no** business or demo data.
