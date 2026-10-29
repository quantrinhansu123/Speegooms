import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";

export function requireJson(req: Request, _res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    next();
    return;
  }
  const type = req.get("content-type");
  if (!type) {
    const length = Number(req.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > 0) {
      next(new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type phải là application/json"));
      return;
    }
    next();
    return;
  }
  const mime = type.split(";")[0]?.trim().toLowerCase();
  if (mime !== "application/json") {
    next(new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type phải là application/json"));
    return;
  }
  next();
}
