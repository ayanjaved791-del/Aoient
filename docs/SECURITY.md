# Security

Status of the controls in spec §22. "✅" means implemented **and** covered by automated tests.

| Control | Status | Implementation |
| --- | --- | --- |
| Password hashing, sessions | ✅ | Better Auth (scrypt), HTTP-only cookies, `Secure` in production, 7-day sessions refreshed daily. |
| Email verification before sensitive actions | ✅ | Sign-in blocked until verified; org creation and invitation acceptance also re-check. |
| Password reset | ✅ | Single-use, 1-hour tokens; generic response (no account enumeration); all sessions revoked on reset. |
| Account deactivation | ✅ | `user.status = deactivated` blocks new sessions and invalidates existing ones in the DAL. |
| Server-side RBAC, deny by default | ✅ | `src/server/permissions/evaluator.ts`; every service asserts its permission. |
| Privilege escalation | ✅ | Cannot grant permissions you lack, cannot grant Owner unless owner, cannot act on more-privileged members or yourself, cannot edit your own role. |
| Tenant isolation | ✅ | `resolveOrgContext` + `organizationId` scoping; cross-tenant tests at service and HTTP layers (`tests/integration/tenant-isolation.test.ts`). |
| No existence leaks | ✅ | Foreign and missing records produce identical NOT_FOUND responses. |
| Input validation | ✅ | Zod on every server entry point (actions, routes); JSON body size limit. |
| Injection | ✅ | Prisma parameterised queries; the one raw query uses tagged-template parameters. |
| CSRF | ✅ | Server Actions have built-in origin checks; `/api/v1` mutations require a same-origin `Origin`/`Sec-Fetch-Site`. Better Auth checks `trustedOrigins`. |
| Open redirects | ✅ | `safeNextPath` allows only same-site relative paths. |
| Rate limiting | ✅ | Auth: sign-in 5/min, sign-up 3/min, reset 3/5 min, verification 3/5 min (per IP, DB-backed). App: invitations 30/h per user & 100/h per org, org creation 10/h, accept 20/h. |
| Invitations | ✅ | 256-bit random token, stored hashed, 7-day expiry, single-use (atomic claim — concurrent accepts tested), bound to recipient email, revocable. |
| Audit log | ✅ | Org/member/role/invitation changes, written in the same transaction; metadata keys resembling secrets are stripped. |
| Security headers | ✅ | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` removed. |
| Secrets | ✅ | `.env` is git-ignored; `.env.example` lists names only; secrets read only in `server-only` modules. |
| Files, Paddle webhooks, API keys | ⏳ | Milestones M5, M8, M7. |
| MFA | ❌ | Not implemented — not claimed. |
| Backups, monitoring | ❌ | Launch tasks (M9). |

## Known gaps / follow-ups

- Better Auth stores session tokens in the database as issued (cookie value is HMAC-signed). Hashing at rest would need a custom adapter hook; tracked for M9 review.
- Content-Security-Policy is not yet set (requires nonce wiring for Next.js inline scripts) — M9.
- Audit log viewer UI arrives with M2 (data is already recorded).
