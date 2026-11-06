"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { leaveOrganizationAction } from "./actions";

export function LeaveOrganization({ slug, organizationName }: { slug: string; organizationName: string }) {
  const router = useRouter();
  return (
    <Card className="border-danger/30">
      <CardHeader><CardTitle>Leave organization</CardTitle><CardDescription>You will lose access to {organizationName} immediately. An admin can invite you again later.</CardDescription></CardHeader>
      <CardContent>
        <ConfirmDialog
          trigger={<Button variant="secondary" className="text-danger">Leave organization</Button>}
          title={`Leave ${organizationName}?`}
          description="You'll lose access to all of this organization's data. This doesn't delete your account."
          confirmLabel="Leave"
          onConfirm={async () => {
            const res = await leaveOrganizationAction(slug);
            if (!res.ok) {
              toast.error(res.error.message);
              return false;
            }
            router.replace("/organizations");
          }}
        />
      </CardContent>
    </Card>
  );
}
