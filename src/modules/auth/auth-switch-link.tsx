"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { safeNextPath } from "@/lib/validation/auth";

/** Link between sign-in and sign-up that keeps where the visitor was going (e.g. checkout). */
export function AuthSwitchLink({ to, children }: { to: "/sign-in" | "/sign-up"; children: ReactNode }) {
  const raw = useSearchParams().get("next");
  const next = raw ? safeNextPath(raw) : null;
  return (
    <Link href={next ? `${to}?next=${encodeURIComponent(next)}` : to} className="font-medium text-primary hover:underline">
      {children}
    </Link>
  );
}
