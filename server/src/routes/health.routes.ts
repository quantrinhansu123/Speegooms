import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import type { HealthController } from "../controllers/health.controller";

export function healthRoutes(controller: HealthController) {
  const router = Router();
  router.get("/", asyncHandler(controller.show));
  return router;
}
