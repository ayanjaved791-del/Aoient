"use client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { addNoteAction, deleteNoteAction } from "./actions";

export interface NoteView { id: string; body: string; author: string; mine: boolean; at: string; ago: string }

/** Notes on a CRM record, newest first, with a box to add one. */
export function Notes({ slug, subjectType, subjectId, notes, canWrite }: {
  slug: string; subjectType: "lead" | "contact" | "company" | "deal"; subjectId: string; notes: NoteView[]; canWrite: boolean;
}) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    const res = await addNoteAction(slug, { subjectType, subjectId, body });
    setSaving(false);
    if (!res.ok) return toast.error(res.error.fields?.body?.[0] ?? res.error.message);
    setBody("");
  }
  return (
    <div className="grid gap-4">
      {canWrite && (
        <form onSubmit={submit} className="grid gap-2">
          <Textarea aria-label="New note" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder="Log a call, a meeting or next steps…"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Ctrl + Enter to save</p>
            <Button type="submit" size="sm" loading={saving} disabled={!body.trim()}><Send />Add note</Button>
          </div>
        </form>
      )}
      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ol className="relative grid gap-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border">
          {notes.map((n, i) => (
            <li key={n.id} className="motion-safe:animate-rise relative flex gap-3" style={{ animationDelay: `${i * 40}ms` }}>
              <Avatar name={n.author} size="sm" className="ring-4 ring-surface" />
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
                <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{n.author}</span>
                  <time dateTime={n.at} title={new Date(n.at).toUTCString()}>{n.ago}</time>
                  {n.mine && (
                    <button type="button" aria-label="Delete note" className="ml-auto rounded p-0.5 hover:text-danger"
                      onClick={async () => { const res = await deleteNoteAction(slug, n.id); if (!res.ok) toast.error(res.error.message); }}>
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{n.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** A search box (and optional select) kept in the URL, so links and refreshes keep the filter. */
export function ListFilters({ placeholder, select }: { placeholder: string; select?: { key: string; label: string; options: { value: string; label: string }[] } }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q.trim()) next.set("q", q.trim()); else next.delete("q");
      if (next.toString() !== params.toString()) startTransition(() => router.replace(`${pathname}?${next}`));
    }, 250);
    return () => clearTimeout(t);
  }, [q, params, pathname, router]);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label={placeholder} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      {select && (
        <Select aria-label={select.label} className="sm:w-48" value={params.get(select.key) ?? ""} options={select.options}
          onValueChange={(value) => {
            const next = new URLSearchParams(params);
            if (value) next.set(select.key, value); else next.delete(select.key);
            router.replace(`${pathname}?${next}`);
          }} />
      )}
    </div>
  );
}
