"use client";
import { ChevronDown, Lock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { deleteRoleAction } from "./actions";
import { RoleEditorDialog, type CatalogGroup } from "./role-editor-dialog";

export interface RoleVM { id: string; name: string; description: string | null; isSystem: boolean; permissions: string[]; memberCount: number; editable: boolean }

export function RolesList({ slug, roles, catalog, heldPermissions, canManage }: { slug: string; roles: RoleVM[]; catalog: CatalogGroup[]; heldPermissions: string[]; canManage: boolean }) {
  const describe = new Map(catalog.flatMap((g) => g.permissions.map((p) => [p.key, { ...p, group: g.label }] as const)));
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {roles.map((role) => {
        const byGroup = new Map<string, string[]>();
        for (const k of role.permissions) {
          const d = describe.get(k);
          if (!d) continue;
          byGroup.set(d.group, [...(byGroup.get(d.group) ?? []), d.description]);
        }
        return (
          <li key={role.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3.5 hover:bg-surface-muted sm:px-5 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                <span className="grid min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {role.name}
                    {role.isSystem ? <Badge><Lock className="size-3" aria-hidden />System</Badge> : <Badge tone="primary">Custom</Badge>}
                  </span>
                  {role.description && <span className="truncate text-[13px] text-muted-foreground">{role.description}</span>}
                </span>
                <span className="text-[13px] text-muted-foreground">{role.permissions.length} permissions · {role.memberCount} {role.memberCount === 1 ? "member" : "members"}</span>
              </summary>
              <div className="grid gap-4 border-t border-border bg-background/50 px-4 py-4 sm:px-5">
                {byGroup.size === 0 ? (
                  <p className="text-sm text-muted-foreground">This role has no permissions.</p>
                ) : (
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {[...byGroup].map(([group, perms]) => (
                      <div key={group}>
                        <dt className="text-[13px] font-medium">{group}</dt>
                        <dd><ul className="mt-1 grid gap-0.5 text-[13px] text-muted-foreground">{perms.map((p) => <li key={p}>{p}</li>)}</ul></dd>
                      </div>
                    ))}
                  </dl>
                )}
                {!role.isSystem && canManage && role.editable && (
                  <div className="flex gap-2">
                    <RoleEditorDialog slug={slug} catalog={catalog} heldPermissions={heldPermissions} role={role} trigger={<Button variant="secondary" size="sm"><Pencil />Edit role</Button>} />
                    <ConfirmDialog
                      trigger={<Button variant="ghost" size="sm" className="text-danger"><Trash2 />Delete</Button>}
                      title={`Delete ${role.name}?`}
                      description="Roles that are assigned to members or pending invitations can't be deleted."
                      confirmLabel="Delete role"
                      onConfirm={async () => {
                        const res = await deleteRoleAction(slug, role.id);
                        if (!res.ok) { toast.error(res.error.message); return false; }
                        toast.success("Role deleted");
                      }}
                    />
                  </div>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
