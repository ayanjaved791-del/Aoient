"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createOrganizationSchema, slugify } from "@/lib/validation/organization";
import { CURRENCIES, timezones } from "@/lib/formatting/options";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";
import { Alert } from "@/components/ui/alert";
import { createOrganizationAction } from "./actions";

type Values = z.input<typeof createOrganizationSchema>;

export function CreateOrganizationForm() {
  const router = useRouter();
  const tzList = useMemo(() => timezones(), []);
  const tzOptions = useMemo(() => tzList.map((tz) => ({ value: tz, label: tz.replaceAll("_", " ") })), [tzList]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "", slug: "", timezone: "UTC", currency: "USD" },
  });
  const { errors, isSubmitting } = form.formState;
  const name = useWatch({ control: form.control, name: "name" });

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tzList.includes(tz)) form.setValue("timezone", tz);
  }, [form, tzList]);

  useEffect(() => {
    if (!slugEdited) form.setValue("slug", slugify(name ?? ""), { shouldValidate: false });
  }, [name, slugEdited, form]);

  async function onSubmit(values: Values) {
    setServerError(null);
    const res = await createOrganizationAction(values);
    if (!res.ok) {
      if (res.error.fields) for (const [k, v] of Object.entries(res.error.fields)) form.setError(k as keyof Values, { message: v[0] });
      if (res.error.code === "CONFLICT") form.setError("slug", { message: res.error.message });
      else setServerError(res.error.message);
      return;
    }
    router.push(`/${res.data.slug}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {serverError && <Alert tone="danger" title={serverError} />}
      <Field id="name" label="Organization name" error={errors.name?.message}>
        <Input autoFocus placeholder="Northwind Studio" {...form.register("name")} />
      </Field>
      <Field id="slug" label="Workspace URL" prefix="aoient/" hint="Lowercase letters, numbers and hyphens." error={errors.slug?.message}>
        <Input {...form.register("slug", { onChange: () => setSlugEdited(true) })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="timezone" label="Time zone" error={errors.timezone?.message}>
          <FormSelect control={form.control} name="timezone" options={tzOptions} searchable />
        </Field>
        <Field id="currency" label="Default currency" error={errors.currency?.message}>
          <FormSelect control={form.control} name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} searchable />
        </Field>
      </div>
      <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto sm:justify-self-end">Create organization</Button>
    </form>
  );
}
