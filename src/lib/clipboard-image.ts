import type { ClipboardEvent } from "react";

/** Lấy 1 ảnh từ clipboard: File, data URL, hoặc https URL. */
export function clipboardImage(event: ClipboardEvent): File | string | null {
  const items = event.clipboardData?.items;
  if (items) {
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
  if (text.startsWith("data:image/") || /^https:\/\/\S+$/.test(text)) return text;
  return null;
}

/** Lấy mọi file ảnh từ clipboard (không gồm data/https text). */
export function clipboardImageFiles(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items) return [];
  const files: File[] = [];
  for (const item of items) {
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}
