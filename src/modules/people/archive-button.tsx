"use client";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { setEmployeeArchivedAction } from "./actions";

export function ArchiveEmployeeButton({ slug, id, name, archived }: { slug: string; id: string; name: string; archived: boolean }) {
  if (archived) {
    return (
      <Button variant="secondary" onClick={async () => {
        const res = await setEmployeeArchivedAction(slug, id, false);
        if (res.ok) toast.success(`${name} is active again`); else toast.error(res.error.message);
      }}><ArchiveRestore />Restore</Button>
    );
  }
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" className="text-muted-foreground hover:text-danger"><Archive />Archive</Button>}
      title={`Archive ${name}?`}
      description="They leave the directory and reporting lines, and pending leave is cancelled. Their record is kept and can be restored."
      confirmLabel="Archive"
      onConfirm={async () => {
        const res = await setEmployeeArchivedAction(slug, id, true);
        if (!res.ok) { toast.error(res.error.message); return false; }
        toast.success(`${name} archived`);
      }}
    />
  );
}
