"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UNITS } from "@/lib/validation/inventory";
import {
  createLocationAction, createProductAction, recordMovementAction, setLocationArchivedAction, setProductArchivedAction, transferStockAction,
  updateLocationAction, updateProductAction,
} from "./actions";
import { qty } from "./format";

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: { message: string; fields?: Record<string, string[]> } };
type Opt = { id: string; name: string; sub?: string };

function useDialogForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  async function run<T>(fn: () => Promise<Result<T>>, ok: (data: T) => void) {
    setError(null); setFields({}); setSaving(true);
    const res = await fn();
    setSaving(false);
    if (!res.ok) { setFields(res.error.fields ?? {}); setError(res.error.message); return; }
    ok(res.data);
    setOpen(false);
  }
  const onOpenChange = (o: boolean) => { setOpen(o); setError(null); setFields({}); };
  return { open, setOpen, onOpenChange, error, saving, run, fe: (k: string) => fields[k]?.[0] };
}

async function act(fn: () => Promise<Result>, ok: string) {
  const res = await fn();
  if (!res.ok) { toast.error(res.error.message); return false; }
  toast.success(ok);
  return true;
}


export const KIND_LABEL: Record<string, string> = { receive: "Received", issue: "Issued", adjust: "Count adjustment", transfer_in: "Transfer in", transfer_out: "Transfer out" };

export function MovementBadge({ kind }: { kind: string }) {
  const tone = kind === "receive" || kind === "transfer_in" ? "success" : kind === "issue" || kind === "transfer_out" ? "neutral" : "warning";
  return <Badge tone={tone}>{KIND_LABEL[kind] ?? kind}</Badge>;
}

export function StockBadge({ onHand, reorderLevel }: { onHand: number; reorderLevel: number }) {
  if (onHand === 0) return <Badge tone="danger">Out of stock</Badge>;
  if (reorderLevel > 0 && onHand <= reorderLevel) return <Badge tone="warning">Low stock</Badge>;
  return <Badge tone="success">In stock</Badge>;
}

/* ─────────────────────────────── products ─────────────────────────────── */

export interface ProductFormValue { id: string; sku: string; name: string; description: string | null; unit: string; costPrice: number; salePrice: number; reorderLevel: number }

export function ProductDialog({ slug, trigger, product, currency }: { slug: string; trigger: ReactNode; product?: ProductFormValue; currency: string }) {
  const f = useDialogForm();
  const blank = { sku: "", name: "", description: "", unit: "pcs", costPrice: "", salePrice: "", reorderLevel: "" };
  const [v, setV] = useState(product ? {
    sku: product.sku, name: product.name, description: product.description ?? "", unit: product.unit,
    costPrice: String(product.costPrice), salePrice: String(product.salePrice), reorderLevel: String(product.reorderLevel),
  } : blank);
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  function submit(e: FormEvent) {
    e.preventDefault();
    const body = { ...v, costPrice: v.costPrice || 0, salePrice: v.salePrice || 0, reorderLevel: v.reorderLevel || 0 };
    f.run(() => (product ? updateProductAction(slug, product.id, body) : createProductAction(slug, body)) as Promise<Result>, () => {
      toast.success(product ? "Product updated" : `${v.name} added. Use “Stock in” to record what you have.`);
      if (!product) setV(blank);
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle><DialogDescription>Something you buy, store or sell. Stock is added with movements, not here.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <Field id="prd-sku" label="SKU / code" error={f.fe("sku")}><Input autoFocus={!product} value={v.sku} onChange={(e) => set("sku")(e.target.value)} maxLength={40} placeholder="TEA-001" /></Field>
            <Field id="prd-name" label="Name" error={f.fe("name")}><Input value={v.name} onChange={(e) => set("name")(e.target.value)} maxLength={160} placeholder="Green tea, 50 bags" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="prd-unit" label="Unit" error={f.fe("unit")}><Select value={v.unit} onValueChange={set("unit")} options={UNITS.map((u) => ({ value: u, label: u }))} /></Field>
            <Field id="prd-reorder" label="Reorder at (optional)" hint="Flag as low stock at or below this" error={f.fe("reorderLevel")}><Input inputMode="decimal" value={v.reorderLevel} onChange={(e) => set("reorderLevel")(e.target.value)} placeholder="0" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="prd-cost" label={`Cost price (${currency})`} error={f.fe("costPrice")}><Input inputMode="decimal" value={v.costPrice} onChange={(e) => set("costPrice")(e.target.value)} placeholder="0.00" /></Field>
            <Field id="prd-sale" label={`Sale price (${currency})`} error={f.fe("salePrice")}><Input inputMode="decimal" value={v.salePrice} onChange={(e) => set("salePrice")(e.target.value)} placeholder="0.00" /></Field>
          </div>
          <Field id="prd-desc" label="Description (optional)" error={f.fe("description")}><Textarea rows={2} value={v.description} onChange={(e) => set("description")(e.target.value)} maxLength={1000} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{product ? "Save" : "Add product"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductArchiveButton({ slug, id, name, archived }: { slug: string; id: string; name: string; archived: boolean }) {
  if (archived) return <Button size="sm" variant="secondary" onClick={() => act(() => setProductArchivedAction(slug, id, false), `${name} restored`)}><ArchiveRestore />Restore</Button>;
  return (
    <ConfirmDialog trigger={<Button variant="secondary" size="sm"><Archive />Archive</Button>}
      title={`Archive ${name}?`} description="It's hidden from lists and stock can't be moved until you restore it. Its history is kept." confirmLabel="Archive"
      onConfirm={() => act(() => setProductArchivedAction(slug, id, true), `${name} archived`)} />
  );
}

/* ─────────────────────────────── locations ─────────────────────────────── */

export function LocationDialog({ slug, trigger, location }: { slug: string; trigger: ReactNode; location?: { id: string; name: string; address: string | null } }) {
  const f = useDialogForm();
  const [v, setV] = useState({ name: location?.name ?? "", address: location?.address ?? "" });
  function submit(e: FormEvent) {
    e.preventDefault();
    f.run(() => (location ? updateLocationAction(slug, location.id, v) : createLocationAction(slug, v)) as Promise<Result>, () => {
      toast.success(location ? "Location updated" : `${v.name} added`);
      if (!location) setV({ name: "", address: "" });
    });
  }
  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{location ? "Edit location" : "New location"}</DialogTitle><DialogDescription>A warehouse, shop, shelf or van where stock is kept.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {f.error && <Alert tone="danger" title={f.error} />}
          <Field id="loc-name" label="Name" error={f.fe("name")}><Input autoFocus value={v.name} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} maxLength={80} placeholder="Main warehouse" /></Field>
          <Field id="loc-addr" label="Address (optional)" error={f.fe("address")}><Textarea rows={2} value={v.address} onChange={(e) => setV((s) => ({ ...s, address: e.target.value }))} maxLength={300} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={f.saving}>{location ? "Save" : "Add location"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocationArchiveButton({ slug, id, name, archived }: { slug: string; id: string; name: string; archived: boolean }) {
  if (archived) return <Button size="sm" variant="secondary" onClick={() => act(() => setLocationArchivedAction(slug, id, false), `${name} restored`)}><ArchiveRestore />Restore</Button>;
  return (
    <ConfirmDialog trigger={<Button variant="ghost" size="icon-sm" aria-label={`Archive ${name}`} className="text-muted-foreground hover:text-danger"><Archive /></Button>}
      title={`Archive ${name}?`} description="Only empty locations can be archived. Its history is kept." confirmLabel="Archive"
      onConfirm={() => act(() => setLocationArchivedAction(slug, id, true), `${name} archived`)} />
  );
}

/* ─────────────────────────────── movements ─────────────────────────────── */

type Mode = "receive" | "issue" | "count" | "transfer";
const MODES: { key: Mode; label: string; help: string }[] = [
  { key: "receive", label: "Stock in", help: "Goods arrived: a purchase, a return or production." },
  { key: "issue", label: "Stock out", help: "Goods left: sold, used, damaged or given away." },
  { key: "count", label: "Count", help: "You counted the shelf. The difference is recorded as an adjustment." },
  { key: "transfer", label: "Transfer", help: "Move stock from one location to another." },
];

export function MovementDialog({ slug, trigger, products, locations, productId, mode: initial = "receive", locationId }: {
  slug: string; trigger: ReactNode; products: Opt[]; locations: Opt[]; productId?: string; mode?: Mode; locationId?: string;
}) {
  const f = useDialogForm();
  const [mode, setMode] = useState<Mode>(initial);
  const first = locationId ?? locations[0]?.id ?? "";
  const [v, setV] = useState({ productId: productId ?? products[0]?.id ?? "", locationId: first, toLocationId: locations.find((l) => l.id !== first)?.id ?? "", quantity: "", unitCost: "", reference: "", note: "" });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  const current = MODES.find((m) => m.key === mode)!;

  function submit(e: FormEvent) {
    e.preventDefault();
    const base = { productId: v.productId, reference: v.reference, note: v.note };
    const call = mode === "transfer"
      ? () => transferStockAction(slug, { productId: v.productId, fromLocationId: v.locationId, toLocationId: v.toLocationId, quantity: v.quantity, note: v.note })
      : mode === "count"
        ? () => recordMovementAction(slug, { ...base, kind: "count", locationId: v.locationId, counted: v.quantity })
        : mode === "receive"
          ? () => recordMovementAction(slug, { ...base, kind: "receive", locationId: v.locationId, quantity: v.quantity, unitCost: v.unitCost })
          : () => recordMovementAction(slug, { ...base, kind: "issue", locationId: v.locationId, quantity: v.quantity });
    f.run(call as () => Promise<Result<{ id?: string | null; balance?: number; from?: number; to?: number }>>, (d) => {
      if (mode === "transfer") toast.success(`Moved. ${qty(d.from ?? 0)} left at the source, ${qty(d.to ?? 0)} at the destination.`);
      else if (mode === "count" && d.id === null) toast.success("The count matches. Nothing changed.");
      else toast.success(`Saved. ${qty(d.balance ?? 0)} now at this location.`);
      setV((s) => ({ ...s, quantity: "", unitCost: "", reference: "", note: "" }));
    });
  }

  const productOpts = products.map((p) => ({ value: p.id, label: p.name, description: p.sub, keywords: p.sub }));
  const locOpts = locations.map((l) => ({ value: l.id, label: l.name }));
  const qtyErr = f.fe(mode === "count" ? "counted" : "quantity");

  return (
    <Dialog open={f.open} onOpenChange={f.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record stock</DialogTitle><DialogDescription>{current.help}</DialogDescription></DialogHeader>
        {products.length === 0 || locations.length === 0 ? (
          <Alert tone="info" title={products.length === 0 ? "Add a product first." : "Add a location first."} />
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4">
            <div role="tablist" aria-label="Kind of movement" className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-surface p-0.5">
              {MODES.map((m) => (
                <button key={m.key} type="button" role="tab" aria-selected={mode === m.key} onClick={() => { setMode(m.key); f.onOpenChange(true); }}
                  className={cn("rounded-md px-2 py-1.5 text-xs font-medium sm:text-sm", mode === m.key ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-surface-muted")}>{m.label}</button>
              ))}
            </div>
            {f.error && <Alert tone="danger" title={f.error} />}
            <Field id="mv-product" label="Product" error={f.fe("productId")}><Select value={v.productId} onValueChange={set("productId")} options={productOpts} disabled={Boolean(productId)} /></Field>
            {mode === "transfer" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="mv-from" label="From" error={f.fe("fromLocationId")}><Select value={v.locationId} onValueChange={set("locationId")} options={locOpts} /></Field>
                <Field id="mv-to" label="To" error={f.fe("toLocationId")}><Select value={v.toLocationId} onValueChange={set("toLocationId")} options={[{ value: "", label: "Pick a location" }, ...locOpts]} /></Field>
              </div>
            ) : (
              <Field id="mv-loc" label="Location" error={f.fe("locationId")}><Select value={v.locationId} onValueChange={set("locationId")} options={locOpts} /></Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="mv-qty" label={mode === "count" ? "Counted quantity" : "Quantity"} error={qtyErr}><Input autoFocus inputMode="decimal" value={v.quantity} onChange={(e) => set("quantity")(e.target.value)} placeholder="0" /></Field>
              {mode === "receive" && <Field id="mv-cost" label="Unit cost (optional)" error={f.fe("unitCost")}><Input inputMode="decimal" value={v.unitCost} onChange={(e) => set("unitCost")(e.target.value)} placeholder="0.00" /></Field>}
              {mode !== "receive" && mode !== "transfer" && <Field id="mv-ref" label="Reference (optional)" error={f.fe("reference")}><Input value={v.reference} onChange={(e) => set("reference")(e.target.value)} maxLength={80} placeholder={mode === "issue" ? "INV-0012" : "Stock-take Nov"} /></Field>}
            </div>
            {mode === "receive" && <Field id="mv-ref2" label="Reference (optional)" error={f.fe("reference")}><Input value={v.reference} onChange={(e) => set("reference")(e.target.value)} maxLength={80} placeholder="PO-104 or supplier bill no." /></Field>}
            <Field id="mv-note" label="Note (optional)" error={f.fe("note")}><Input value={v.note} onChange={(e) => set("note")(e.target.value)} maxLength={300} /></Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => f.setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={f.saving}>Save</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
