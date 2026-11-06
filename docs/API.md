# API — `/api/v1`

Cookie-session authenticated JSON API (scoped API keys arrive in M7). All tenant routes verify membership of `:id` on the server; foreign or unknown organizations return `404 NOT_FOUND`.

## Envelopes

```jsonc
// success
{ "data": { … }, "meta": { … } }
// error
{ "error": { "code": "VALIDATION_ERROR", "message": "Check the highlighted fields", "fields": { "slug": ["…"] } } }
```

| Code | HTTP |
| --- | --- |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 (also cross-origin mutations) |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `VALIDATION_ERROR` | 422 |
| `RATE_LIMITED` | 429 + `Retry-After` |
| `INTERNAL_ERROR` | 500 (no stack traces or DB errors leaked) |

Mutations must be same-origin (`Origin` header matching `APP_URL`).

## Organizations (M1)

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/organizations` | signed in — lists the caller's active memberships |
| POST | `/api/v1/organizations` | verified email — `{ name, slug, timezone?, currency? }` |
| GET | `/api/v1/organizations/:id` | `organization.read` |
| PATCH | `/api/v1/organizations/:id` | `organization.update` |
| GET | `/api/v1/organizations/:id/members?q=&status=` | `organization.members.read` |
| PATCH | `/api/v1/organizations/:id/members/:memberId` | `organization.members.manage` — `{ roleId?, status? }` |
| DELETE | `/api/v1/organizations/:id/members/:memberId` | `organization.members.remove` |
| GET | `/api/v1/organizations/:id/invitations` | `organization.members.read` |
| POST | `/api/v1/organizations/:id/invitations` | `organization.members.invite` — `{ email, roleId }` |
| DELETE | `/api/v1/organizations/:id/invitations/:invitationId` | `organization.members.invite` |
| GET | `/api/v1/organizations/:id/roles` | `organization.members.read` |
| POST | `/api/v1/organizations/:id/roles` | `organization.roles.manage` — `{ name, description?, permissions[] }` |
| PATCH / DELETE | `/api/v1/organizations/:id/roles/:roleId` | `organization.roles.manage` (custom roles only) |

Authentication is handled by Supabase Auth (the browser talks to Supabase directly; email links land on `/auth/confirm`).
