"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, MailPlus, UserPlus } from "lucide-react";
import type { z } from "zod";
import { createInvitationSchema } from "@/lib/validation/organization";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { inviteMemberAction } from "./actions";
import { InviteLinkPanel, type InviteLink } from "./invite-link-panel";

type Values = z.input<typeof createInvitationSchema>;

export function InviteMemberDialog({ slug, organizationName, roles, defaultRoleId }: { slug: string; organizationName: string; roles: { id: string; name: string; description: string | null }[]; defaultRoleId?: string }) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<InviteLink | null>(null);
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
    form.reset({ email: "", roleId: values.roleId });
    setCreated(res.data);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setServerError(null); setCreated(null); } }}>
      <DialogTrigger asChild><Button><MailPlus />Invite member</Button></DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CircleCheck className="size-5 text-success" aria-hidden />Invitation ready</DialogTitle>
              <DialogDescription>Send this link to {created.email}. They open it, sign in or sign up with that email, and join as {created.roleName}.</DialogDescription>
            </DialogHeader>
            <InviteLinkPanel invite={created} organizationName={organizationName} />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreated(null)}><UserPlus />Invite another</Button>
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>Choose their email and role. You&apos;ll get a join link to share; it works once and expires in 7 days.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
          {serverError && <Alert tone="danger" title={serverError} />}
          <Field id="invite-email" label="Email address" error={errors.email?.message}>
            <Input type="email" autoComplete="off" placeholder="name@company.com" {...form.register("email")} />
          </Field>
          <Field id="invite-role" label="Role" hint={selectedRole?.description ?? undefined} error={errors.roleId?.message}>
            <FormSelect control={form.control} name="roleId" options={roles.map((r) => ({ value: r.id, label: r.name, description: r.description }))} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Create invite link</Button>
          </DialogFooter>
        </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
