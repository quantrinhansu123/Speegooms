import { Router } from "express";
import { updateRoleSchema } from "@speego/shared";
import { asyncHandler } from "../lib/async-handler";
import { requirePermission } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import type { AppContainer } from "../container";

export function userRoutes(container: AppContainer) {
  const router = Router();
  const admin = container.userAdminController;
  router.use(container.authenticate);
  router.get("/", requirePermission("user.role.assign"), asyncHandler(admin.list));
  router.patch("/:id/role", requirePermission("user.role.assign"), validate({ body: updateRoleSchema }), asyncHandler(admin.updateRole));
  return router;
}
