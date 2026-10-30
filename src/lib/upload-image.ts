import { api } from "@/lib/api";
import { mapPool } from "@/lib/map-pool";

type CompressOptions = {
  maxEdge?: number;
  quality?: number;
  maxChars?: number;
};

const DEFAULT_UPLOAD_CONCURRENCY = 4;

export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<string> {
  const maxEdge = options.maxEdge ?? 420;
  const quality = options.quality ?? 0.78;
  const maxChars = options.maxChars ?? 100_000;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không đọc được ảnh");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", quality);
  if (url.length > maxChars) throw new Error("Ảnh quá lớn, hãy chọn ảnh nhỏ hơn");
  return url;
}

export async function uploadDataImage(dataUri: string): Promise<string> {
  if (/^https:\/\//i.test(dataUri)) return dataUri;
  const body = await api<{ url: string }>("/api/uploads/image", {
    method: "POST",
    body: JSON.stringify({ image: dataUri }),
  });
  if (!body.url?.startsWith("https://")) throw new Error("Không nhận được URL ảnh");
  return body.url;
}

export async function uploadImageFile(file: File, options?: CompressOptions): Promise<string> {
  const compressed = await compressImageFile(file, options);
  return uploadDataImage(compressed);
}

export async function uploadImageSource(
  source: File | string,
  options?: CompressOptions,
): Promise<string> {
  if (typeof source === "string") return uploadDataImage(source);
  return uploadImageFile(source, options);
}

export async function uploadImageFiles(
  files: File[],
  options?: CompressOptions,
  concurrency = DEFAULT_UPLOAD_CONCURRENCY,
): Promise<string[]> {
  return mapPool(files, concurrency, (file) => uploadImageFile(file, options));
}

export async function uploadImageSources(
  sources: Array<File | string>,
  options?: CompressOptions,
  concurrency = DEFAULT_UPLOAD_CONCURRENCY,
): Promise<string[]> {
  return mapPool(sources, concurrency, (source) => uploadImageSource(source, options));
}
