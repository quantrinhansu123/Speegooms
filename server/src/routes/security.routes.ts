import { Router } from "express";
import type { SecurityController } from "../controllers/security.controller";

export function securityRoutes(controller: SecurityController) {
  const router = Router();
  router.get("/csrf", controller.token);
  return router;
}
