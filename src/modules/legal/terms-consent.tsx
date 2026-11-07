"use client";
import Link from "next/link";
import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** "I agree to the Terms and Privacy Policy". Links open in a new tab so nothing typed is lost. */
export function TermsConsent({ checked, onChange, error, className, purpose = "continue" }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string | null;
  className?: string;
  purpose?: string;
}) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors", error ? "border-danger bg-danger-subtle/40" : checked ? "border-primary/40 bg-primary-subtle/50" : "border-border bg-surface-muted/50")}>
        <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
        <label htmlFor={id} className="text-sm leading-relaxed text-secondary-foreground">
          I have read and agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">Terms of Service</Link>{" "}
          and the{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">Privacy Policy</Link>, and I&apos;m authorised to {purpose} on behalf of my organization.
        </label>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
