"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/errors";

const OUTPUT = 256;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/**
 * Shrinks a picture to 256×256 in the browser. "cover" fills the square
 * (profile pictures); "contain" fits the whole picture inside it with a
 * transparent edge (logos, which are often wide). Re-encoding also drops
 * camera details such as location from the file.
 */
async function shrink(file: File, fit: "cover" | "contain"): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("no canvas");
  const scale = fit === "cover" ? Math.max(OUTPUT / bitmap.width, OUTPUT / bitmap.height) : Math.min(OUTPUT / bitmap.width, OUTPUT / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  c.imageSmoothingQuality = "high";
  c.drawImage(bitmap, (OUTPUT - w) / 2, (OUTPUT - h) / 2, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (blob && blob.type === "image/webp") return blob;
  // Browsers that can't write WebP (older Safari) fall back to PNG.
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("encode failed");
  return png;
}

export function ImageUpload({
  currentUrl,
  fallback,
  shape,
  label,
  hint,
  disabled,
  disabledReason,
  upload,
  remove,
}: {
  currentUrl: string | null;
  /** Shown when there's no picture (initials or first letter). */
  fallback: string;
  shape: "circle" | "square";
  label: string;
  hint: string;
  disabled?: boolean;
  disabledReason?: string;
  upload: (form: FormData) => Promise<ActionResult<unknown>>;
  remove: () => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const shown = preview ?? currentUrl;

  async function send(file: File | undefined) {
    if (!file || disabled) return;
    if (!/^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.type)) {
      toast.error("Use a PNG, JPG or WebP picture.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error("That picture is larger than 10 MB. Choose a smaller one.");
      return;
    }
    setBusy("upload");
    try {
      const blob = await shrink(file, shape === "circle" ? "cover" : "contain");
      const local = URL.createObjectURL(blob);
      setPreview(local);
      const form = new FormData();
      form.append("file", blob, blob.type === "image/png" ? "picture.png" : "picture.webp");
      const res = await upload(form);
      if (res.ok) {
        toast.success(`${label} updated.`);
        router.refresh();
      } else {
        setPreview(null);
        toast.error(res.error.message);
      }
    } catch {
      setPreview(null);
      toast.error(navigator.onLine ? "That picture couldn't be read. Try a different file." : "You're offline. Reconnect and try again.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function clear() {
    setBusy("remove");
    try {
      const res = await remove();
      if (res.ok) {
        setPreview(null);
        toast.success(`${label} removed.`);
        router.refresh();
      } else toast.error(res.error.message);
    } catch {
      toast.error("You're offline. Reconnect and try again.");
    } finally {
      setBusy(null);
    }
  }

  const round = shape === "circle" ? "rounded-full" : "rounded-xl";
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void send(e.dataTransfer.files?.[0]); }}
        aria-label={`Choose a new ${label.toLowerCase()}`}
        className={cn(
          "group relative flex size-20 shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-muted text-xl font-semibold text-muted-foreground transition-colors disabled:cursor-not-allowed",
          round,
          dragging && "border-primary ring-4 ring-primary/20",
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, per-user image behind a membership check
          <img src={shown} alt="" className={cn("size-full", shape === "circle" ? "object-cover" : "object-contain")} />
        ) : (
          <span aria-hidden>{fallback}</span>
        )}
        {!disabled && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ImageUp className="size-5" aria-hidden />
          </span>
        )}
      </button>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" loading={busy === "upload"} disabled={disabled || busy !== null} onClick={() => input.current?.click()}>
            {busy !== "upload" && <ImageUp className="size-4" aria-hidden />}{shown ? "Change" : "Upload"}
          </Button>
          {currentUrl && (
            <Button type="button" variant="ghost" size="sm" loading={busy === "remove"} disabled={disabled || busy !== null} onClick={clear}>
              {busy !== "remove" && <Trash2 className="size-4" aria-hidden />}Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{disabled && disabledReason ? disabledReason : hint}</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void send(e.target.files?.[0])}
      />
    </div>
  );
}
