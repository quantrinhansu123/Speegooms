import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("x-request-id");
  const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  const path = req.originalUrl.split("?")[0] ?? req.path;
  res.on("finish", () => {
    logger.info("request", {
      requestId,
      method: req.method,
      path,
      status: res.statusCode,
    });
  });
  next();
}
