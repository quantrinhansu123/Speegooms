import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;
/** Ngân sách thời gian phản hồi của API; vượt mức sẽ log warn để theo dõi. */
export const SLOW_REQUEST_MS = 2000;

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("x-request-id");
  const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  const path = req.originalUrl.split("?")[0] ?? req.path;
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    const fields = { requestId, method: req.method, path, status: res.statusCode, durationMs };
    logger.info("request", fields);
    if (durationMs > SLOW_REQUEST_MS) logger.warn("slow request", fields);
  });
  next();
}
