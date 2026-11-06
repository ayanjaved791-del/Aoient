import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-md border px-4 py-3 text-sm", {
  variants: {
    tone: {
      info: "border-primary/20 bg-primary-subtle text-foreground [&>svg]:text-primary",
      success: "border-success/25 bg-success-subtle text-foreground [&>svg]:text-success",
      warning: "border-warning/30 bg-warning-subtle text-foreground [&>svg]:text-warning",
      danger: "border-danger/25 bg-danger-subtle text-foreground [&>svg]:text-danger",
    },
  },
  defaultVariants: { tone: "info" },
});

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

export function Alert({ tone = "info", title, children, className }: VariantProps<typeof alertVariants> & { title?: string; children?: React.ReactNode; className?: string }) {
  const Icon = icons[tone ?? "info"];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn(alertVariants({ tone }), className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-secondary-foreground">{children}</div>}
      </div>
    </div>
  );
}
