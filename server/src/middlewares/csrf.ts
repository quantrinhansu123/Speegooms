import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { RequestHandler, Response } from "express";
import type { Env } from "../config/env";
import { AppError } from "../lib/errors";

function csrfCookieName(env: Env): string {
  return env.NODE_ENV === "production" ? "__Host-speego_csrf" : "speego_csrf";
}

export interface CsrfGuard {
  protect: RequestHandler;
  issue: (res: Response) => string;
}

export function createCsrfGuard(env: Env): CsrfGuard {
  const name = csrfCookieName(env);
  const base = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 1000,
  };

  const issue = (res: Response) => {
    const token = randomBytes(32).toString("base64url");
    const hash = createHmac("sha256", env.CSRF_SECRET).update(token).digest("base64url");
    res.cookie(name, hash, base);
    return token;
  };

  const protect: RequestHandler = (req, _res, next) => {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      next();
      return;
    }
    const header = req.get("x-csrf-token");
    const cookie = req.cookies?.[name];
    if (typeof header !== "string" || typeof cookie !== "string" || header.length < 40 || header.length > 80) {
      next(new AppError(403, "CSRF_INVALID", "CSRF token không hợp lệ"));
      return;
    }
    const expected = createHmac("sha256", env.CSRF_SECRET).update(header).digest("base64url");
    const left = Buffer.from(expected);
    const right = Buffer.from(cookie);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      next(new AppError(403, "CSRF_INVALID", "CSRF token không hợp lệ"));
      return;
    }
    next();
  };

  return { protect, issue };
}
