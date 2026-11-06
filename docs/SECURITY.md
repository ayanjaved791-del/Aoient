# Security

Status of the controls in spec §22. "✅" means implemented **and** covered by automated tests.

| Control | Status | Implementation |
| --- | --- | --- |
| Password hashing, sessions | ✅ | Supabase Auth (bcrypt); session in cookies managed by `@supabase/ssr`, refreshed by the proxy; the server verifies the JWT (`getClaims`) on every request. |
| Email verification before sensitive actions | ✅ | Supabase blocks sign-in until the email is confirmed (keep "Confirm email" on); org creation and invitation acceptance re-check `profile.email_verified`. |
| Password reset | ✅ | Supabase recovery link → `/auth/confirm` → new password; generic response (no account enumeration); all sessions signed out (`scope: global`) after the change. |
| Account deactivation | ✅ | `profile.status = deactivated` makes the DAL treat the user as signed out. |
| Server-side RBAC, deny by default | ✅ | `src/server/permissions/evaluator.ts`; every service asserts its permission. |
| Privilege escalation | ✅ | Cannot grant permissions you lack, cannot grant Owner unless owner, cannot act on more-privileged members or yourself, cannot edit your own role. |
| Tenant isolation | ✅ | `resolveOrgContext` + `organizationId` scoping; cross-tenant tests at service and HTTP layers (`tests/integration/tenant-isolation.test.ts`). |
| No existence leaks | ✅ | Foreign and missing records produce identical NOT_FOUND responses. |
| Input validation | ✅ | Zod on every server entry point (actions, routes); JSON body size limit. |
| Injection | ✅ | All SQL uses `postgres` tagged templates (parameterised); non-UUID ids are rejected before any query. Dynamic SQL is limited to fixed identifiers in migrations/tests. |
| CSRF | ✅ | Server Actions have built-in origin checks; `/api/v1` mutations require a same-origin `Origin`/`Sec-Fetch-Site`. Auth requests go directly from the browser to Supabase. |
| Open redirects | ✅ | `safeNextPath` allows only same-site relative paths. |
| Rate limiting | ✅ | Auth: Supabase Auth's built-in limits (configurable in the dashboard). App: invitations 30/h per user & 100/h per org, org creation 10/h, accept 20/h. |
| Invitations | ✅ | 256-bit random token, stored hashed, 7-day expiry, single-use (atomic claim — concurrent accepts tested), bound to recipient email, revocable. |
| Audit log | ✅ | Org/member/role/invitation changes, written in the same transaction; metadata keys resembling secrets are stripped. |
| Security headers | ✅ | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` removed. |
| Data API lock-down | ✅ | RLS enabled on every `public` table with no policies; tests prove `anon`/`authenticated` read 0 rows and cannot write. |
| Secrets | ✅ | `.env` is git-ignored; `.env.example` lists names only; secrets read only in `server-only` modules. |
| Paddle webhooks & licenses | ✅ | Paid plans change only through webhooks verified with HMAC-SHA256 (`Paddle-Signature`, 5-minute window); each event ID applied once; stale events ignored; plan taken from the Paddle price ID. The organization comes from a known subscription or a server-signed checkout token (only members with `billing.manage` can get one), so a browser can't point a payment at another tenant or overwrite a live subscription. Limits are checked inside the same transaction as the change, with the organization row locked. |
| Files, API keys | ⏳ | Milestones M5, M7. |
| MFA | ❌ | Not implemented — not claimed. |
| Backups, monitoring | ❌ | Launch tasks (M9). |

## Known gaps / follow-ups

- Supabase Auth flows (sign-up, sign-in, reset) are verified against a local stand-in of the Auth API, not yet against a live Supabase project.
- Content-Security-Policy is not yet set (requires nonce wiring for Next.js inline scripts) — M9.
- Audit log viewer UI arrives with M2 (data is already recorded).
