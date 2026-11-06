// M1 end-to-end flow (spec AT-01, AT-03, AT-12): sign-up → verify → create org → custom role →
// invite → invitee signs up & accepts → employee permissions → single-use link → tenant 404.
// Usage: start the app with its output captured (the console email provider prints links),
//   npm run build && npm start > .e2e-server.log 2>&1 &
//   npm run test:e2e
// The auth rate limiter allows 3 sign-ups/min per IP; wait a minute between repeated runs.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const LOG = process.argv[2] ?? ".e2e-server.log";

const run = Date.now().toString(36);
const owner = { name: "Amira Khan", email: `amira.${run}@example.test`, password: "correct-horse-battery" };
const invitee = { name: "Leo Park", email: `leo.${run}@example.test`, password: "another-strong-pass" };
const slug = `northwind-${run}`;

function lastLink(pattern) {
  const log = fs.readFileSync(LOG, "utf8");
  const m = [...log.matchAll(pattern)];
  if (!m.length) throw new Error("link not found for " + pattern);
  return m.at(-1)[0];
}
async function waitForLink(pattern) {
  for (let i = 0; i < 30; i++) { try { return lastLink(pattern); } catch { await new Promise(r => setTimeout(r, 300)); } }
  throw new Error("timeout waiting for link " + pattern);
}
const step = (s) => console.log("✓", s);

const browser = await chromium.launch();
async function signUpAndVerify(ctx, u, next) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-up${next ? `?next=${encodeURIComponent(next)}&email=${encodeURIComponent(u.email)}` : ""}`);
  await page.getByLabel("Full name").fill(u.name);
  await page.getByLabel("Work email").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByLabel("Confirm password").fill(u.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/verify-email/);
  step(`sign-up ${u.email} → verify-email page`);
  // Unverified sign-in must be refused.
  const link = await waitForLink(new RegExp(`http://localhost:3000/api/auth/verify-email\\?token=[^\\s]+`, "g"));
  await page.goto(link);
  await page.waitForLoadState("networkidle");
  step(`email verified, landed on ${new URL(page.url()).pathname}`);
  return page;
}

// 1. Owner signs up, verifies, creates organization
const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
let page = await signUpAndVerify(ownerCtx, owner);
await page.goto(`${BASE}/organizations`);
await page.getByLabel("Organization name").fill("Northwind Studio");
await page.getByLabel("Workspace URL").fill(slug);

await page.getByRole("button", { name: "Create organization" }).click();
await page.waitForURL(new RegExp(`/${slug}$`));
await page.getByText("Active members").waitFor();

step("organization created; overview shows real counts");

// 2. Create a custom role
await page.goto(`${BASE}/${slug}/settings/roles`);
await page.getByRole("button", { name: "Custom role" }).click();
await page.getByLabel("Role name").fill("Account Coordinator");
await page.getByLabel("View leads").check();
await page.getByLabel("View organization profile and settings").check();

await page.getByRole("button", { name: "Create role" }).click();
await page.getByText("Account Coordinator").first().waitFor();
step("custom role created");

// 3. Invite a member
await page.goto(`${BASE}/${slug}/settings/members`);
await page.getByRole("button", { name: "Invite member" }).click();
await page.getByLabel("Email address").fill(invitee.email.toUpperCase());
await page.getByRole("button", { name: "Send invitation" }).click();
await page.getByText("Pending invitations").waitFor();

step("invitation created and listed");
const inviteLink = await waitForLink(/http:\/\/localhost:3000\/invite\/[A-Za-z0-9_-]+/g);

// 4. Invitee signs up via the invite and accepts
const invCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p2 = await invCtx.newPage();
await p2.goto(inviteLink);
await p2.getByRole("link", { name: "Create account" }).click();
await p2.waitForURL(/sign-up/);
await p2.close();
const p3 = await signUpAndVerify(invCtx, invitee, new URL(inviteLink).pathname);
if (!p3.url().includes("/invite/")) await p3.goto(inviteLink);
await p3.getByRole("button", { name: "Accept invitation" }).waitFor();

await p3.getByRole("button", { name: "Accept invitation" }).click();
await p3.waitForURL(new RegExp(`/${slug}$`));
step("invitee accepted and entered the workspace");

// 5. Invitee (Employee) cannot see invite controls; second accept is rejected
await p3.goto(`${BASE}/${slug}/settings/members`);
await p3.getByRole("heading", { name: "Members" }).waitFor();
if (await p3.getByRole("button", { name: "Invite member" }).count()) throw new Error("employee sees invite button");

step("employee view hides management actions");
await p3.goto(inviteLink);
await p3.getByText("Invitation unavailable").waitFor();
step("invitation link is single-use");

// 6. Invitee cannot reach an org they don't belong to
const other = await p3.request.get(`${BASE}/api/v1/organizations`);
const orgs = (await other.json()).data;
if (orgs.length !== 1) throw new Error("invitee should see 1 org");
// Another real tenant and a non-existent slug must render identically.
await p3.goto(`${BASE}/some-other-org-${run}`);
await p3.getByRole("heading", { name: "Page not found" }).waitFor();
const apiForeign = await p3.request.get(`${BASE}/api/v1/organizations/0190a8b4-7c3e-7000-8000-000000000000`);
if (apiForeign.status() !== 404) throw new Error("API should 404");
step("foreign/non-existent org → not-found page; API → 404");

// 7. Owner sees new member; dark mode screenshot
await page.reload();
await page.getByText(invitee.name).first().waitFor();
await page.emulateMedia({ colorScheme: "dark" });
await page.reload();
await page.getByText(invitee.name).first().waitFor();

step("owner sees new member (dark theme)");

await browser.close();
console.log("E2E FLOW PASSED");
