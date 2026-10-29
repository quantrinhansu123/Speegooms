import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import hpp from "hpp";
import type { Env } from "./config/env";
import type { AppContainer } from "./container";
import { createCors } from "./middlewares/cors";
import { errorHandler } from "./middlewares/error-handler";
import { notFound } from "./middlewares/not-found";
import { globalRateLimit } from "./middlewares/rate-limit";
import { requestContext } from "./middlewares/request-context";
import { requireJson } from "./middlewares/require-json";
import { securityHeaders } from "./middlewares/security-headers";
import { xssClean } from "./middlewares/xss";
import { registerRoutes } from "./routes";

export function createApp(env: Env, container: AppContainer): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);
  app.set("trust proxy", env.TRUST_PROXY ? 1 : "loopback");
  app.use(requestContext);
  app.use(securityHeaders(env));
  app.use(createCors(env));
  app.use(globalRateLimit);
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(hpp());
  app.use(xssClean);
  app.use(requireJson);
  registerRoutes(app, container);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
