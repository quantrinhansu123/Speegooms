import { Router } from "express";
import { setAssignmentOffSchema } from "@speego/shared";
import type { AppContainer } from "../container";
import { asyncHandler } from "../lib/async-handler";
import { requireAnyPermission } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";

export function chiaDonRoutes(container: AppContainer) {
  const router = Router();
  const c = container.assignmentController;
  const readers = requireAnyPermission(["quote.read", "quote.rfq"]);
  router.use(container.authenticate);
  router.get("/:desk/members", readers, asyncHandler(c.members));
  router.get("/:desk/assignees", readers, asyncHandler(c.assignees));
  // Quyền chỉnh người khác kiểm tra trong controller (mỗi người luôn tự chỉnh được của mình).
  router.put("/:desk/members/:userId", requireAnyPermission(["quote.read"]), validate({ body: setAssignmentOffSchema }), asyncHandler(c.setOff));
  return router;
}
