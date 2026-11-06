import type { ZodError } from "zod";

/**
 * Lỗi Zod theo từng ô: lấy thông báo đầu tiên của mỗi trường (phần tử đầu của path).
 * `fieldIds` đổi tên trường của schema sang id ô trên form; trường không có trong map giữ nguyên tên.
 */
export function zodFieldErrors(error: ZodError, fieldIds: Record<string, string> = {}): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (!key) continue;
    const id = fieldIds[key] ?? key;
    if (!errors[id]) errors[id] = issue.message;
  }
  return errors;
}

/** Bỏ lỗi của một ô khi người dùng sửa ô đó. */
export function withoutFieldError(errors: Record<string, string>, id: string): Record<string, string> {
  if (!errors[id]) return errors;
  const next = { ...errors };
  delete next[id];
  return next;
}
