import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/**
 * Form field wrapper: label, control, helper text and inline error, wired with
 * aria-describedby/aria-invalid so screen readers announce errors.
 */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  prefix,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  /** Static add-on rendered before the control (e.g. a URL prefix). */
  prefix?: React.ReactNode;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = React.cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
  });
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {prefix ? (
        <div className="flex rounded-md shadow-xs [&>[data-slot=input]]:rounded-l-none [&>[data-slot=input]]:shadow-none">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-surface-muted px-3 text-sm text-muted-foreground">{prefix}</span>
          {control}
        </div>
      ) : (
        control
      )}
      {hint && !error && <p id={hintId} className="text-[13px] text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
