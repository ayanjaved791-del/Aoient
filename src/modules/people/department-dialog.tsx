"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createDepartmentAction, deleteDepartmentAction, updateDepartmentAction } from "./actions";

export function DepartmentDialog({ slug, trigger, department, people }: {
  slug: string; trigger: ReactNode; people: { id: string; name: string }[];
  department?: { id: string; name: string; description: string | null; headId: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(department?.name ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [head, setHead] = useState(department?.headId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null); setSaving(true);
    const input = { name, description, headEmployeeId: head };
    const res = department ? await updateDepartmentAction(slug, department.id, input) : await createDepartmentAction(slug, input);
    setSaving(false);
    if (!res.ok) return setError(res.error.fields?.name?.[0] ?? res.error.message);
    toast.success(department ? "Department updated" : `${name} created`);
    setOpen(false);
    if (!department) { setName(""); setDescription(""); setHead(""); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{department ? "Edit department" : "New department"}</DialogTitle><DialogDescription>Departments group people into teams.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {error && <Alert tone="danger" title={error} />}
          <Field id="dept-name" label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Front desk" /></Field>
          <Field id="dept-desc" label="Description (optional)"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={240} /></Field>
          <Field id="dept-head" label="Department head (optional)">
            <Select value={head} onValueChange={setHead} options={[{ value: "", label: "None" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{department ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDepartmentButton({ slug, id, name, count }: { slug: string; id: string; name: string; count: number }) {
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`} className="text-muted-foreground hover:text-danger"><Trash2 /></Button>}
      title={`Delete ${name}?`}
      description={count ? `${count} ${count === 1 ? "person stays" : "people stay"} in People without a department.` : "This department has no one in it."}
      confirmLabel="Delete"
      onConfirm={async () => {
        const res = await deleteDepartmentAction(slug, id);
        if (!res.ok) { toast.error(res.error.message); return false; }
        toast.success(`${name} deleted`);
      }}
    />
  );
}
