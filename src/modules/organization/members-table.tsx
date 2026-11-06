"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { MoreHorizontal, Search, UserMinus, UserCheck, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { removeMemberAction, updateMemberAction } from "./actions";

export interface MemberVM {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  joinedAt: string;
  role: { id: string; name: string };
  isSelf: boolean;
  canManage: boolean;
  canRemove: boolean;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function MemberFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q.trim()) next.set("q", q.trim()); else next.delete("q");
      if (next.toString() !== params.toString()) startTransition(() => router.replace(`${pathname}?${next}`));
    }, 250);
    return () => clearTimeout(t);
  }, [q, params, pathname, router]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search members" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <NativeSelect
        aria-label="Filter by status"
        className="sm:w-44"
        value={params.get("status") ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set("status", e.target.value); else next.delete("status");
          router.replace(`${pathname}?${next}`);
        }}
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </NativeSelect>
    </div>
  );
}

function RoleCell({ slug, member, roles }: { slug: string; member: MemberVM; roles: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  if (!member.canManage) return <span className="text-sm text-secondary-foreground">{member.role.name}</span>;
  const options = roles.some((r) => r.id === member.role.id) ? roles : [member.role, ...roles];
  return (
    <NativeSelect
      aria-label={`Role for ${member.name}`}
      className="h-8 w-full max-w-48 text-[13px]"
      defaultValue={member.role.id}
      disabled={pending}
      onChange={(e) => {
        const roleId = e.target.value;
        startTransition(async () => {
          const res = await updateMemberAction(slug, member.id, { roleId });
          if (res.ok) toast.success(`${member.name} is now ${options.find((r) => r.id === roleId)?.name}`);
          else {
            toast.error(res.error.message);
            e.target.value = member.role.id;
          }
        });
      }}
    >
      {options.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </NativeSelect>
  );
}

function RowActions({ slug, member }: { slug: string; member: MemberVM }) {
  const [pending, startTransition] = useTransition();
  if (!member.canManage && !member.canRemove) return null;
  const suspended = member.status === "suspended";
  return (
    <div className="flex justify-end">
      {member.canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`} loading={pending}>{!pending && <MoreHorizontal />}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                startTransition(async () => {
                  const res = await updateMemberAction(slug, member.id, { status: suspended ? "active" : "suspended" });
                  if (res.ok) toast.success(suspended ? `${member.name} reactivated` : `${member.name} suspended`);
                  else toast.error(res.error.message);
                })
              }
            >
              {suspended ? <><UserCheck />Reactivate access</> : <><UserX />Suspend access</>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {member.canRemove && (
        <ConfirmDialog
          trigger={<Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.name}`} className="text-muted-foreground hover:text-danger"><UserMinus /></Button>}
          title={`Remove ${member.name}?`}
          description="They will immediately lose access to this organization. Records they created stay in place."
          confirmLabel="Remove member"
          onConfirm={async () => {
            const res = await removeMemberAction(slug, member.id);
            if (!res.ok) { toast.error(res.error.message); return false; }
            toast.success(`${member.name} removed`);
          }}
        />
      )}
    </div>
  );
}

export function MembersTable({ slug, members, roles, filtered }: { slug: string; members: MemberVM[]; roles: { id: string; name: string }[]; filtered: boolean }) {
  return (
    <div className="grid gap-4">
      <MemberFilters />
      {members.length === 0 ? (
        <EmptyState icon={Users} title={filtered ? "No members match your filters" : "No members yet"} description={filtered ? "Try a different search or status." : undefined} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-[13px] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Member</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} />
                        <div className="grid min-w-0">
                          <span className="truncate font-medium">{m.name}{m.isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}</span>
                          <span className="truncate text-[13px] text-muted-foreground">{m.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleCell slug={slug} member={m} roles={roles} /></td>
                    <td className="px-4 py-3"><Badge tone={m.status === "active" ? "success" : "warning"}>{m.status === "active" ? "Active" : "Suspended"}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{dateFmt.format(new Date(m.joinedAt))}</td>
                    <td className="px-4 py-3"><RowActions slug={slug} member={m} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="grid gap-3 md:hidden">
            {members.map((m) => (
              <li key={m.id} className="grid gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={m.name} />
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">{m.name}{m.isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}</span>
                    <span className="truncate text-[13px] text-muted-foreground">{m.email}</span>
                  </div>
                  <Badge tone={m.status === "active" ? "success" : "warning"}>{m.status === "active" ? "Active" : "Suspended"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><RoleCell slug={slug} member={m} roles={roles} /></div>
                  <RowActions slug={slug} member={m} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
