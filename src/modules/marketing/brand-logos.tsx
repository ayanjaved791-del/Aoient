import type { SimpleIcon } from "simple-icons";

/** A real brand mark (Simple Icons), coloured by the caller. */
export function BrandMark({ icon, className }: { icon: SimpleIcon; className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className}>
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
}
