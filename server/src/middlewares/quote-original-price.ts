import { canViewQuoteOriginalPrice } from "@speego/shared";
import type { RequestHandler } from "express";

/** Bao gồm cả bản nháp, snapshot đã gửi, lịch sử và nguồn hợp đồng lồng nhau. */
export function withoutOriginalPrices(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutOriginalPrices);
  if (!value || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "originalPrice" && key !== "originalDetails").map(([key, item]) => [key, withoutOriginalPrices(item)]));
}

export const protectQuoteOriginalPrices: RequestHandler = (req, res, next) => {
  if (!req.user || !canViewQuoteOriginalPrice(req.user.role)) {
    req.body = withoutOriginalPrices(req.body);
    const json = res.json;
    res.json = (body: unknown) => json.call(res, withoutOriginalPrices(body));
  }
  next();
};
