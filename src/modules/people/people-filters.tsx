"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/** Search, department and status filters, kept in the URL so links and refreshes keep them. */
export function PeopleFilters({ departments }: { departments: { id: string; name: string }[] }) {
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

  const setParam = (key: string) => (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next}`);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search people" placeholder="Search by name, email, title or ID" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <Select aria-label="Filter by department" className="sm:w-52" value={params.get("dept") ?? ""} onValueChange={setParam("dept")}
        options={[{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
      <Select aria-label="Filter by status" className="sm:w-40" value={params.get("status") ?? ""} onValueChange={setParam("status")}
        options={[{ value: "", label: "Active" }, { value: "archived", label: "Archived" }, { value: "all", label: "Everyone" }]} />
    </div>
  );
}
