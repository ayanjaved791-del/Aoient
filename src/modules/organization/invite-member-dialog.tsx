"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailPlus } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { createInvitationSchema } from "@/lib/validation/organization";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { inviteMemberAction } from "./actions";

type Values = z.input<typeof createInvitationSchema>;

export function InviteMemberDialog({ slug, roles, defaultRoleId }: { slug: string; roles: { id: string; name: string; description: string | null }[]; defaultRoleId?: string }) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(createInvitationSchema), defaultValues: { email: "", roleId: defaultRoleId ?? roles[0]?.id ?? "" } });
  const { errors, isSubmitting } = form.formState;
  const roleId = useWatch({ control: form.control, name: "roleId" });
  const selectedRole = roles.find((r) => r.id === roleId);

  async function onSubmit(values: Values) {
    setServerError(null);
    const res = await inviteMemberAction(slug, values);
    if (!res.ok) {
      if (res.error.fields) for (const [k, v] of Object.entries(res.error.fields)) form.setError(k as keyof Values, { message: v[0] });
      else setServerError(res.error.message);
      return;
    }
    toast.success(`Invitation created for ${values.email}`, {
      description: res.data.delivered ? undefined : "Email delivery isn't configured yet — the invitation link was written to the server log.",
    });
    form.reset({ email: "", roleId: values.roleId });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setServerError(null); }}>
      <DialogTrigger asChild><Button><MailPlus />Invite member</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>They&apos;ll get a single-use link that expires in 7 days.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
          {serverError && <Alert tone="danger" title={serverError} />}
          <Field id="invite-email" label="Email address" error={errors.email?.message}>
            <Input type="email" autoComplete="off" placeholder="name@company.com" {...form.register("email")} />
          </Field>
          <Field id="invite-role" label="Role" hint={selectedRole?.description ?? undefined} error={errors.roleId?.message}>
            <NativeSelect {...form.register("roleId")}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</NativeSelect>
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Send invitation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
