import { Router, type Express } from "express";
import { asyncHandler } from "../lib/async-handler";
import { marketingRoutes } from "./marketing.routes";
import { kpiRoutes } from "./kpi.routes";
import type { AppContainer } from "../container";
import { authRoutes } from "./auth.routes";
import { crmRoutes } from "./crm.routes";
import { chiaDonRoutes } from "./chia-don.routes";
import { dataLanhRoutes } from "./data-lanh.routes";
import { deXuatRoutes } from "./de-xuat.routes";
import { healthRoutes } from "./health.routes";
import { keToanRoutes } from "./ke-toan.routes";
import { notificationRoutes } from "./notification.routes";
import { securityRoutes } from "./security.routes";
import { uploadRoutes } from "./uploads.routes";
import { userRoutes } from "./users.routes";

/** Thêm module mới: controller -> service -> repository, rồi mount ở đây. */
export function registerRoutes(app: Express, container: AppContainer) {
  const api = Router();
  api.use(container.csrf.protect);
  api.use("/marketing", marketingRoutes(container));
  api.use("/settings/kpis", kpiRoutes(container));
  api.get("/sales-report", container.authenticate, asyncHandler(container.salesReportController.read));
  api.get("/targets/scope", container.authenticate, asyncHandler(container.targetsController.scope));
  api.get("/targets", container.authenticate, asyncHandler(container.targetsController.read));
  api.put("/targets", container.authenticate, asyncHandler(container.targetsController.write));
  api.use("/health", healthRoutes(container.healthController));
  api.use("/security", securityRoutes(container.securityController));
  api.use("/auth", authRoutes(container));
  api.use("/users", userRoutes(container));
  api.use("/crm", crmRoutes(container));
  api.use("/chia-don", chiaDonRoutes(container));
  api.use("/data-lanh", dataLanhRoutes(container));
  api.use("/de-xuat", deXuatRoutes(container));
  api.use("/ke-toan", keToanRoutes(container));
  api.use("/notifications", notificationRoutes(container));
  api.use("/uploads", uploadRoutes(container));
  app.use("/api", api);
}
