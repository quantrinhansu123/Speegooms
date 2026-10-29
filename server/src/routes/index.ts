import { Router, type Express } from "express";
import type { AppContainer } from "../container";
import { authRoutes } from "./auth.routes";
import { crmRoutes } from "./crm.routes";
import { healthRoutes } from "./health.routes";
import { securityRoutes } from "./security.routes";
import { userRoutes } from "./users.routes";

/** Thêm module mới: controller -> service -> repository, rồi mount ở đây. */
export function registerRoutes(app: Express, container: AppContainer) {
  const api = Router();
  api.use(container.csrf.protect);
  api.use("/health", healthRoutes(container.healthController));
  api.use("/security", securityRoutes(container.securityController));
  api.use("/auth", authRoutes(container));
  api.use("/users", userRoutes(container));
  api.use("/crm", crmRoutes(container));
  app.use("/api", api);
}
