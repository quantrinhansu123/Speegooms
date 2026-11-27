import { canViewQuoteOriginalPrice } from "@speego/shared";
import type { RequestHandler } from "express";

/** Bao gồm cả bản nháp, snapshot đã gửi, lịch sử và nguồn hợp đồng lồng nhau. */
/** `accounting`: Kế toán chỉ thấy giá gốc của báo giá đã ra hợp đồng; object có contractStatus quyết định cho phần lồng bên trong. */
export function withoutOriginalPrices(value: unknown, accounting = false, allowed = false): unknown {
  if (Array.isArray(value)) return value.map(item => withoutOriginalPrices(item, accounting, allowed));
  if (!value || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
  const here = "contractStatus" in value ? accounting && value.contractStatus === "DA_TAO" : allowed;
  return Object.fromEntries(Object.entries(value).filter(([key]) => here || (key !== "originalPrice" && key !== "originalDetails")).map(([key, item]) => [key, withoutOriginalPrices(item, accounting, here)]));
}

export const protectQuoteOriginalPrices: RequestHandler = (req, res, next) => {
  const accounting = req.user?.role === "ke-toan";
  if (!req.user || !canViewQuoteOriginalPrice(req.user.role) || accounting) {
    req.body = withoutOriginalPrices(req.body);
    const json = res.json;
    res.json = (body: unknown) => json.call(res, withoutOriginalPrices(body, accounting));
  }
  next();
};
