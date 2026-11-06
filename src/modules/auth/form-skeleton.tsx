import { Skeleton } from "@/components/ui/skeleton";

export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="grid gap-4" aria-busy aria-label="Loading">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="grid gap-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-full" /></div>
      ))}
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
