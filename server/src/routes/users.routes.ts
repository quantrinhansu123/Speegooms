import { Router } from "express";
import { createUserSchema, updateUserSchema, updateRoleSchema } from "@speego/shared";
import { asyncHandler } from "../lib/async-handler";
import { requirePermission } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import type { AppContainer } from "../container";

export function userRoutes(container: AppContainer) {
  const router = Router();
  const admin = container.userAdminController;
  router.use(container.authenticate);
  router.use(requirePermission("user.role.assign"));
  router.post("/", validate({ body: createUserSchema }), asyncHandler(admin.create));
  router.patch("/:id", validate({ body: updateUserSchema }), asyncHandler(admin.update));
  router.delete("/:id", asyncHandler(admin.delete));
  router.get("/", asyncHandler(admin.list));
  router.patch("/:id/role", validate({ body: updateRoleSchema }), asyncHandler(admin.updateRole));
  return router;
}
