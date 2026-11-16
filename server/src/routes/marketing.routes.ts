import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler } from "../lib/async-handler";
export function marketingRoutes(c: AppContainer) {
  const r = Router(); r.use(c.authenticate);
  r.get("/", asyncHandler(c.marketingController.list));
  r.get("/tasks/:id", asyncHandler(c.marketingController.task));
  r.post("/tasks", asyncHandler(c.marketingController.saveTasks));
  r.post("/reports", asyncHandler(c.marketingController.saveReports));
  return r;
}
