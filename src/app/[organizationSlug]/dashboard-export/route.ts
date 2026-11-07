import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { getDashboard, parseRange } from "@/server/dashboard/dashboard";
import { AppError } from "@/lib/errors";
import { toCsv } from "@/lib/csv";

/**
 * GET /{slug}/dashboard-export?range=30 → the dashboard's numbers as CSV.
 * Membership is verified on the server; each section is included only when
 * the member's role can see it on the dashboard.
 */
export async function GET(req: NextRequest, { params }: RouteContext<"/[organizationSlug]/dashboard-export">) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const { organizationSlug } = await params;
  let ctx;
  try {
    ctx = await resolveOrgContext(user.id, { slug: organizationSlug });
  } catch (e) {
    if (e instanceof AppError) return new Response("Not found.", { status: 404 });
    throw e;
  }
  const range = parseRange(req.nextUrl.searchParams.get("range"));
  const d = await getDashboard(ctx, range);
  if (!d.team && !d.activity) return new Response("Your role can't export dashboard data.", { status: 403 });

  const rows: unknown[][] = [["Aoient dashboard", ctx.organization.name], ["Range (days)", range], ["Time zone", d.timezone], ["Exported at", new Date()], []];
  if (d.team) {
    const t = d.team;
    rows.push(["Summary", "Value"], ["Active members", t.activeMembers], ["Suspended members", t.suspendedMembers], ["Owners and admins", t.adminMembers],
      [`Joined in last ${range} days`, t.joinedInRange], [`Joined in previous ${range} days`, t.joinedPrevRange],
      ["Pending invitations", t.invitations.pending], [`Invitations sent in last ${range} days`, t.invitations.sent],
      ["Accepted", t.invitations.accepted], ["Expired", t.invitations.expired], ["Revoked", t.invitations.revoked],
      ["Median hours to accept", t.medianAcceptHours ?? ""], []);
    rows.push(["Role", "Active members"], ...t.roles.map((r) => [r.name, r.count]), []);
    rows.push(["Day", "Team size"], ...t.teamByDay.map((p) => [p.day, p.value]), []);
  }
  if (d.activity) {
    rows.push(["Day", "Recorded changes"], ...d.activity.byDay.map((p) => [p.day, p.value]), []);
    rows.push(["Area", "Changes"], ...d.activity.byArea.map((a) => [a.area, a.count]), []);
    rows.push(["Person", "Changes"], ...d.activity.topPeople.map((p) => [p.name, p.count]), []);
  }
  const file = `aoient-${ctx.organization.slug}-dashboard-${range}d.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
