import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { AppError } from "../lib/errors";

function onLimited(): RequestHandler {
  return (_req, _res, next) => {
    next(new AppError(429, "RATE_LIMITED", "Quá nhiều yêu cầu, thử lại sau"));
  };
}

export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.originalUrl.split("?")[0] === "/api/health",
  handler: onLimited(),
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: onLimited(),
});
