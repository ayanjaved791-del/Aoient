"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createRoleAction, updateRoleAction } from "./actions";

export interface CatalogGroup {
  module: string;
  label: string;
  released: boolean;
  permissions: { key: string; description: string }[];
}

export function RoleEditorDialog({
  slug, catalog, heldPermissions, trigger, role,
}: {
  slug: string;
  catalog: CatalogGroup[];
  heldPermissions: string[];
  trigger: React.ReactNode;
  role?: { id: string; name: string; description: string | null; permissions: string[] };
}) {
  const held = useMemo(() => new Set(heldPermissions), [heldPermissions]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setSelected(new Set(role?.permissions ?? []));
    setErrors({});
    setServerError(null);
  }

  function toggle(key: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return setErrors({ name: "Use at least 2 characters" });
    setErrors({});
    setServerError(null);
    setSubmitting(true);
    const payload = { name: trimmed, description: description.trim(), permissions: [...selected] };
    const res = role ? await updateRoleAction(slug, role.id, payload) : await createRoleAction(slug, payload);
    setSubmitting(false);
    if (!res.ok) {
      if (res.error.fields?.name) setErrors({ name: res.error.fields.name[0] });
      setServerError(res.error.message);
      return;
    }
    toast.success(role ? "Role updated" : "Role created");
    setOpen(false);
    if (!role) reset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? `Edit ${role.name}` : "Create custom role"}</DialogTitle>
          <DialogDescription>You can only include permissions your own role holds.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-5">
          {serverError && <Alert tone="danger" title={serverError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="role-name" label="Role name" error={errors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </Field>
            <Field id="role-description" label="Description (optional)">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={240} />
            </Field>
          </div>
          <fieldset className="grid gap-4">
            <legend className="mb-2 text-sm font-medium">Permissions <span className="font-normal text-muted-foreground">({selected.size} selected)</span></legend>
            {catalog.map((group) => (
              <div key={group.module} className="rounded-md border border-border">
                <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2">
                  <span className="text-sm font-medium">{group.label}</span>
                  {!group.released && <Badge>Module not yet available</Badge>}
                </div>
                <ul className="grid gap-px p-1 sm:grid-cols-2">
                  {group.permissions.map((p) => {
                    const disabled = !held.has(p.key);
                    const id = `perm-${p.key}`;
                    return (
                      <li key={p.key} className="flex items-start gap-2.5 rounded px-2 py-1.5">
                        <Checkbox id={id} checked={selected.has(p.key)} disabled={disabled} onCheckedChange={(v) => toggle(p.key, v === true)} className="mt-0.5" />
                        <label htmlFor={id} className={disabled ? "grid cursor-not-allowed opacity-60" : "grid cursor-pointer"}>
                          <span className="text-[13px] text-foreground">{p.description}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{p.key}{disabled && " · not in your role"}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </fieldset>
          <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t border-border bg-surface px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>{role ? "Save role" : "Create role"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
