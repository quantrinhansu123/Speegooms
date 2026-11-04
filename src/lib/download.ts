/** Tải một Blob về máy dưới tên `filename`. Giải phóng URL tạm sau `revokeAfterMs`. */
export function downloadBlob(filename: string, blob: Blob, revokeAfterMs = 10_000): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
}
