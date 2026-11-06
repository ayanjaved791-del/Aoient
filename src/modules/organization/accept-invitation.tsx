"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { acceptInvitationAction } from "./actions";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      {error && <Alert tone="danger" title={error} />}
      <Button
        loading={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await acceptInvitationAction(token);
          if (res.ok) router.push(`/${res.data.organizationSlug}`);
          else {
            setError(res.error.message);
            setPending(false);
          }
        }}
      >
        Accept invitation
      </Button>
    </div>
  );
}
