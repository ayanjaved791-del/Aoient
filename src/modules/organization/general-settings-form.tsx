"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { createOrganizationSchema } from "@/lib/validation/organization";
import { CURRENCIES, timezones } from "@/lib/formatting/options";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOrganizationAction } from "./actions";

type Values = z.input<typeof createOrganizationSchema>;

export function GeneralSettingsForm({ slug, initial, readOnly }: { slug: string; initial: Required<Values>; readOnly: boolean }) {
  const router = useRouter();
  const tzList = useMemo(() => {
    const list = timezones();
    return list.includes(initial.timezone) ? list : [initial.timezone, ...list];
  }, [initial.timezone]);
  const currencies = CURRENCIES.includes(initial.currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [initial.currency, ...CURRENCIES];
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(createOrganizationSchema), defaultValues: initial });
  const { errors, isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: Values) {
    setServerError(null);
    const res = await updateOrganizationAction(slug, values);
    if (!res.ok) {
      if (res.error.fields) for (const [k, v] of Object.entries(res.error.fields)) form.setError(k as keyof Values, { message: v[0] });
      if (res.error.code === "CONFLICT") form.setError("slug", { message: res.error.message });
      else setServerError(res.error.message);
      return;
    }
    form.reset(values);
    toast.success("Organization settings saved");
    if (res.data.slug !== slug) router.replace(`/${res.data.slug}/settings/general`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Organization profile</CardTitle>
          <CardDescription>Used across every module. Time zone controls how dates and times are displayed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {readOnly && <Alert tone="info" title="View only">Your role can view these settings but not change them.</Alert>}
          {serverError && <Alert tone="danger" title={serverError} />}
          <fieldset disabled={readOnly} className="grid gap-4">
            <Field id="name" label="Organization name" error={errors.name?.message}><Input {...form.register("name")} /></Field>
            <Field id="slug" label="Workspace URL" hint="Changing this breaks existing bookmarks to the old URL." error={errors.slug?.message}>
              <Input {...form.register("slug")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="timezone" label="Time zone" error={errors.timezone?.message}>
                <FormSelect control={form.control} name="timezone" disabled={readOnly} searchable options={tzList.map((tz) => ({ value: tz, label: tz.replaceAll("_", " ") }))} />
              </Field>
              <Field id="currency" label="Default currency" error={errors.currency?.message}>
                <FormSelect control={form.control} name="currency" disabled={readOnly} searchable options={currencies.map((c) => ({ value: c, label: c }))} />
              </Field>
            </div>
          </fieldset>
        </CardContent>
        {!readOnly && (
          <CardFooter>
            {isDirty && <span className="mr-auto text-[13px] text-muted-foreground">Unsaved changes</span>}
            <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => form.reset(initial)}>Discard</Button>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}
