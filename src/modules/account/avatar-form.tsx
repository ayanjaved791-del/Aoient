"use client";
import { ImageUpload } from "@/components/media/image-upload";
import { removeAvatarAction, uploadAvatarAction } from "./actions";

export function AvatarForm({ currentUrl, fallback }: { currentUrl: string | null; fallback: string }) {
  return (
    <ImageUpload
      currentUrl={currentUrl}
      fallback={fallback}
      shape="circle"
      label="Profile picture"
      hint="PNG, JPG or WebP. Drop it here or click to choose; we crop it to a square."
      upload={uploadAvatarAction}
      remove={removeAvatarAction}
    />
  );
}
