import type { NextFunction, Request, Response } from "express";
import xss from "xss";
import { AppError } from "../lib/errors";

const MAX_DEPTH = 8;
const MAX_KEYS = 40;
const MAX_ARRAY = 100;
const MAX_STRING = 20_000;
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object"],
};

export function cleanText(input: string): string {
  return xss(input, xssOptions);
}

export function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) throw new AppError(400, "PAYLOAD_REJECTED", "Dữ liệu quá sâu");
  if (typeof value === "string") {
    if (value.length > MAX_STRING) throw new AppError(400, "PAYLOAD_REJECTED", "Chuỗi quá dài");
    return cleanText(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AppError(400, "PAYLOAD_REJECTED", "Số không hợp lệ");
    return value;
  }
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) throw new AppError(400, "PAYLOAD_REJECTED", "Danh sách quá dài");
    return value.map((item) => sanitizeUnknown(item, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_KEYS) throw new AppError(400, "PAYLOAD_REJECTED", "Đối tượng quá lớn");
    const out: Record<string, unknown> = {};
    for (const [key, inner] of entries) {
      if (BLOCKED_KEYS.has(key) || key.startsWith("$") || key.includes("\0")) continue;
      out[key] = sanitizeUnknown(inner, depth + 1);
    }
    return out;
  }
  throw new AppError(400, "PAYLOAD_REJECTED", "Kiểu dữ liệu không được hỗ trợ");
}

function scrubRecord(target: Record<string, unknown>) {
  for (const key of Object.keys(target)) {
    if (BLOCKED_KEYS.has(key) || key.startsWith("$") || key.includes("\0")) {
      delete target[key];
      continue;
    }
    target[key] = sanitizeUnknown(target[key]);
  }
}

export function xssClean(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.body !== undefined) req.body = sanitizeUnknown(req.body);
    scrubRecord(req.query as Record<string, unknown>);
    scrubRecord(req.params as Record<string, unknown>);
    next();
  } catch (error) {
    next(error);
  }
}
