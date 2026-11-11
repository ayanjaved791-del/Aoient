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
| Invitations | ✅ | 256-bit random token, stored hashed, 7-day expiry, single-use (atomic claim — concurrent accepts tested), bound to recipient email, revocable. Signed-in people also see open invitations for their own verified email and can join without the link; joining by id applies the same email check, and another person's invitation id reads as not found. |
| Logos and profile pictures | ✅ | Only PNG/JPEG/WebP, detected from the file's bytes (never its name or claimed type), max 512 KB, re-encoded to 256 px in the browser. Stored in the database (RLS on, no browser access) and served by the app only to signed-in members: an organization's logo to its active members, a picture to its owner and people in a workspace where they are active members; everyone else gets the same 404. Responses are private, `nosniff` and `default-src 'none'; sandbox`. Changing the logo needs `organization.update`, is blocked while read-only and is audited. |
| Sign-in help | ✅ | After Supabase refuses a sign-in, the app says whether the email has an account (no account / wrong password / unverified / turned off). This reveals registration, as sign-up already does, so it is limited to 20 lookups per hour per network address and 10 per email, then only says "incorrect email or password". |
| Audit log | ✅ | Org/member/role/invitation changes, written in the same transaction; metadata keys resembling secrets are stripped. |
| Security headers | ✅ | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` removed. |
| Data API lock-down | ✅ | RLS enabled on every `public` table with no policies; tests prove `anon`/`authenticated` read 0 rows and cannot write. |
| Secrets | ✅ | `.env` is git-ignored; `.env.example` lists names only; secrets read only in `server-only` modules. |
| Paddle webhooks & licenses | ✅ | Paid plans change only through webhooks verified with HMAC-SHA256 (`Paddle-Signature`, 5-minute window); each event ID applied once; stale events ignored; plan taken from the Paddle price ID. The organization comes from a known subscription or a server-signed checkout token (only members with `billing.manage` can get one), so a browser can't point a payment at another tenant or overwrite a live subscription. Limits are checked inside the same transaction as the change, with the organization row locked. |
| CRM records | ✅ | Every CRM service checks its own permission (`crm.lead.*`, `crm.contact.*`, `crm.deal.*`, `crm.pipeline.manage`, `crm.report.read`) and scopes by the verified organization; cross-organization links are refused by the service and by composite foreign keys (`tests/integration/crm.test.ts`). Reports never convert currencies with made-up rates. |
| Projects | ✅ | Project visibility follows membership unless the role can edit projects; employees change only tasks assigned to them or that they created; assigning others needs `projects.task.assign`; the plan's active-project limit is checked on the server; cross-organization reads and links are refused (`tests/integration/projects.test.ts`). |
| Finance | ✅ | Each finance service checks its own permission (`finance.invoice.*`, `finance.payment.record`, `finance.expense.*`, `finance.vendor.manage`, `finance.report.read`) and scopes by the verified organization; totals are recomputed on the server; payments can't exceed what's owed; cross-organization reads and links are refused by the service and by composite foreign keys (`tests/integration/finance.test.ts`). |
| Time | ✅ | People only see and change their own entries (another person's entry reads as not found); `time.entry.read_all` sees everyone's, `time.timesheet.approve` reviews weeks but never one's own (except the owner); submitted, approved and invoiced time is locked; time can only be logged on projects the person can see; cross-organization reads and links are refused (`tests/integration/time.test.ts`). |
| Assistant (Ant) | ✅ | Rule-based, no outside AI. Summaries are built from the same services as the module pages, so they only include what the role can open. Create and delete requests become a stored proposal; nothing changes until the same person confirms it (button or "yes"), once, within 10 minutes. The change runs through the normal service with the person's own permissions at that moment, so a role change in between is respected (`tests/integration/assistant-commands.test.ts`). |
| Sign-up without email | ✅ | When Supabase can't send the confirmation email, the server creates the login (service-role key, rate-limited per IP and email, Turnstile checked with `TURNSTILE_SECRET_KEY` when on). The email is marked unproven in server-only `app_metadata`, so it never unlocks invitations by email alone; only a join link sent to that email works (`tests/integration/self-signup.test.ts`). Add custom SMTP in Supabase to verify every email again. |
| Files, API keys | ⏳ | Milestones M5, M7. |
| MFA | ❌ | Not implemented — not claimed. |
| Backups, monitoring | ❌ | Launch tasks (M9). |

## Known gaps / follow-ups

- Supabase Auth flows (sign-up, sign-in, reset) are verified against a local stand-in of the Auth API, not yet against a live Supabase project.
- Content-Security-Policy is not yet set (requires nonce wiring for Next.js inline scripts) — M9.
- Audit log viewer UI arrives with M2 (data is already recorded).
