"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Tries the `aoient://` link once on load; the button is there if the browser asks first. */
export function OpenDesktopApp({ href }: { href: string }) {
  useEffect(() => {
    window.location.href = href;
  }, [href]);
  return (
    <Button asChild className="w-full">
      <a href={href}>Open Aoient</a>
    </Button>
  );
}
