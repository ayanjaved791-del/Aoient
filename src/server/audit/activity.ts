import "server-only";
import { getDb } from "@/server/database/client";
import { assertPermission, type OrgContext } from "@/server/tenancy/context";
import { describeActivity, type ActivityItem, type ActivityRow } from "@/lib/activity";

/**
 * Latest audit events for the caller's organization only. The organization ID
 * comes from the server-verified membership context, never from the browser.
 */
export async function listRecentActivity(ctx: OrgContext, limit = 8): Promise<ActivityItem[]> {
  assertPermission(ctx, "organization.audit.read");
  const rows = await getDb()<{
    id: string; action: string; source: ActivityRow["source"]; actor_name: string | null; subject_name: string | null;
    metadata: Record<string, unknown> | null; created_at: Date;
  }[]>`
    select a.id, a.action, a.source, nullif(actor.name, '') as actor_name, nullif(subject.name, '') as subject_name,
           a.metadata, a.created_at
    from audit_log a
    left join profile actor on actor.id = a.actor_user_id
    left join profile subject on subject.id::text = a.metadata->>'userId'
    where a.organization_id = ${ctx.organizationId}
    order by a.created_at desc, a.id desc
    limit ${Math.min(Math.max(limit, 1), 50)}`;
  return rows.map((r) =>
    describeActivity({
      id: r.id, action: r.action, source: r.source, actorName: r.actor_name, subjectName: r.subject_name,
      metadata: r.metadata, createdAt: r.created_at,
    }),
  );
}

/**
 * Events in the last `days` days for the caller's organization. With
 * `onlyMine`, just the caller's own actions; no audit permission is needed for
 * that, since people may always see what they did themselves.
 */
export async function listActivitySince(ctx: OrgContext, opts: { days: number; limit?: number; onlyMine?: boolean }): Promise<{ total: number; items: ActivityItem[] }> {
  if (!opts.onlyMine) assertPermission(ctx, "organization.audit.read");
  const days = Math.min(Math.max(Math.round(opts.days), 1), 365);
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 50);
  const db = getDb();
  const mine = opts.onlyMine ? db`and a.actor_user_id = ${ctx.userId}` : db``;
  const [rows, [count]] = await Promise.all([
    db<{
      id: string; action: string; source: ActivityRow["source"]; actor_name: string | null; subject_name: string | null;
      metadata: Record<string, unknown> | null; created_at: Date;
    }[]>`
      select a.id, a.action, a.source, nullif(actor.name, '') as actor_name, nullif(subject.name, '') as subject_name, a.metadata, a.created_at
      from audit_log a
      left join profile actor on actor.id = a.actor_user_id
      left join profile subject on subject.id::text = a.metadata->>'userId'
      where a.organization_id = ${ctx.organizationId} and a.created_at >= now() - make_interval(days => ${days}) ${mine}
      order by a.created_at desc, a.id desc
      limit ${limit}`,
    db<{ n: number }[]>`
      select count(*)::int as n from audit_log a
      where a.organization_id = ${ctx.organizationId} and a.created_at >= now() - make_interval(days => ${days}) ${mine}`,
  ]);
  return {
    total: count.n,
    items: rows.map((r) => describeActivity({ id: r.id, action: r.action, source: r.source, actorName: r.actor_name, subjectName: r.subject_name, metadata: r.metadata, createdAt: r.created_at })),
  };
}
