import type { RequestHandler } from "express";
import helmet from "helmet";
import type { Env } from "../config/env";

export function securityHeaders(env: Env): RequestHandler {
  const protect = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: env.NODE_ENV === "production" ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: "no-referrer" },
  });

  return (req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader("Cache-Control", "no-store");
    protect(req, res, next);
  };
}
