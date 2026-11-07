import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-6 [overflow-wrap:anywhere]">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="rounded-lg border border-border bg-surface p-6 shadow-xs">{children}</div>
      {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
    </div>
  );
}
