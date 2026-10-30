/** Shared Cloudinary validation — dùng chung env, route, adapter. */

export const DATA_IMAGE =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/i;

export const CLOUDINARY_FOLDER =
  /^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,63}$/;

export const CLOUDINARY_IMAGE_MAX_CHARS = 100_000;

export function normalizeCloudinaryFolder(folder: string | undefined, fallback = "speego"): string {
  return (folder ?? fallback).trim().replace(/^\/+|\/+$/g, "");
}
