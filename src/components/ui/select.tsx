"use client";
import * as React from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** Secondary line under the label (e.g. what a role can do). */
  description?: string | null;
  /** Extra words the search box should match. */
  keywords?: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  placeholder?: string;
  /** Shows a filter box; defaults to on for long lists. */
  searchable?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Submitted with native forms when set. */
  name?: string;
}

/**
 * Themed replacement for <select>: a combobox button opening a listbox with
 * keyboard support (arrows, Home/End, Enter, Escape, type-to-jump) and an
 * optional search box for long lists such as time zones.
 */
export function Select({
  value, onValueChange, options, id, placeholder = "Select…", searchable, disabled, size = "md",
  className, contentClassName, name, ...aria
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const typeahead = React.useRef({ text: "", at: 0 });
  const listId = React.useId();
  const withSearch = searchable ?? options.length > 12;
  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.value} ${o.keywords ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  function openList(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    }
  }

  React.useEffect(() => {
    if (!open) return;
    // The list mounts in a portal on open; wait a frame so it exists before scrolling.
    const id = requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [active, open, filtered]);

  function choose(o: SelectOption | undefined) {
    if (!o) return;
    if (o.value !== value) onValueChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    const last = filtered.length - 1;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(last, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(last); }
    else if (e.key === "Enter" || (e.key === " " && !withSearch)) { e.preventDefault(); choose(filtered[active]); }
    else if (e.key === "Tab") setOpen(false);
    else if (!withSearch && e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      const t = typeahead.current;
      t.text = now - t.at < 700 ? t.text + e.key.toLowerCase() : e.key.toLowerCase();
      t.at = now;
      const i = filtered.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
      if (i >= 0) setActive(i);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={openList}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          disabled={disabled}
          data-slot="select"
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); openList(true); }
          }}
          className={cn(
            "group flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-surface text-left text-foreground shadow-xs transition-colors",
            "hover:border-secondary-foreground/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
            "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-ring/25",
            size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3 text-sm",
            className,
          )}
          {...aria}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
        </button>
      </Popover.Trigger>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (withSearch ? (e.currentTarget as HTMLElement).querySelector("input") : listRef.current)?.focus();
          }}
          className={cn(
            "z-50 flex max-h-[min(22rem,var(--radix-popover-content-available-height))] w-[max(var(--radix-popover-trigger-width),12rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface/95 text-foreground shadow-lg ring-1 ring-black/5 backdrop-blur-md",
            "origin-[var(--radix-popover-content-transform-origin)] data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
            contentClassName,
          )}
        >
          {withSearch && (
            <div className="relative border-b border-border p-1.5">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onListKey}
                placeholder="Search…"
                aria-label="Search options"
                aria-controls={listId}
                aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                className="h-8 w-full rounded-md bg-surface-muted pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/25"
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={withSearch ? -1 : 0}
            aria-label={aria["aria-label"]}
            aria-activedescendant={!withSearch && filtered[active] ? `${listId}-${active}` : undefined}
            onKeyDown={withSearch ? undefined : onListKey}
            className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 outline-none"
          >
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</li>}
            {filtered.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    "flex cursor-pointer select-none items-start gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                    i === active && "bg-surface-muted",
                    isSelected && "font-medium text-primary",
                  )}
                >
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate">{o.label}</span>
                    {o.description && <span className="mt-0.5 line-clamp-2 text-xs font-normal text-muted-foreground">{o.description}</span>}
                  </span>
                  <Check className={cn("mt-0.5 size-4 shrink-0 text-primary", !isSelected && "invisible")} aria-hidden />
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
