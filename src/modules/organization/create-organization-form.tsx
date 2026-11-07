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
import { TermsConsent } from "@/modules/legal/terms-consent";

type Values = z.input<typeof createOrganizationSchema>;

export function CreateOrganizationForm({ termsAccepted = false }: { termsAccepted?: boolean }) {
  const router = useRouter();
  const tzList = useMemo(() => timezones(), []);
  const tzOptions = useMemo(() => tzList.map((tz) => ({ value: tz, label: tz.replaceAll("_", " ") })), [tzList]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
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
    if (!termsAccepted && !agree) {
      setAgreeError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    const res = await createOrganizationAction({ ...values, acceptTerms: termsAccepted || agree });
    if (!res.ok) {
      if (res.error.fields?.acceptTerms) setAgreeError(res.error.fields.acceptTerms[0]);
      else if (res.error.fields) for (const [k, v] of Object.entries(res.error.fields)) form.setError(k as keyof Values, { message: v[0] });
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
      {termsAccepted ? (
        <p className="text-xs text-muted-foreground">
          By creating a workspace you continue to agree to our <a href="/terms" target="_blank" className="underline underline-offset-4 hover:text-foreground">Terms</a> and <a href="/privacy" target="_blank" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</a>.
        </p>
      ) : (
        <TermsConsent checked={agree} onChange={(v) => { setAgree(v); if (v) setAgreeError(null); }} error={agreeError} purpose="create this workspace" />
      )}
      <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto sm:justify-self-end">Create organization</Button>
    </form>
  );
}
