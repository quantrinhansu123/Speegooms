import { createHash } from "node:crypto";

/** 32 byte base64url, không padding. */
const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;

export function isSessionId(value: string): boolean {
  return SESSION_ID.test(value);
}

/** Lưu hash trong DB. Lộ bảng sessions vẫn không dùng được làm cookie. */
export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}
