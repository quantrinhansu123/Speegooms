import { Router } from "express";
import { createProposalSchema, decideProposalSchema, deleteProposalsSchema, saveProposalTemplateSchema } from "@speego/shared";
import type { AppContainer } from "../container";
import { asyncHandler } from "../lib/async-handler";
import { requirePermission } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";

/** Mọi tài khoản đều tạo đề xuất và duyệt đề xuất được giao; xem toàn bộ / quản lý mẫu cần quyền riêng. */
export function deXuatRoutes(container: AppContainer) {
  const router = Router();
  const c = container.deXuatController;
  router.use(container.authenticate);
  router.get("/", asyncHandler(c.list));
  router.post("/", validate({ body: createProposalSchema }), asyncHandler(c.create));
  router.get("/users", asyncHandler(c.users));
  router.get("/templates", asyncHandler(c.templates));
  router.post("/templates", requirePermission("proposal.template"), validate({ body: saveProposalTemplateSchema }), asyncHandler(c.saveTemplate));
  router.put("/templates/:id", requirePermission("proposal.template"), validate({ body: saveProposalTemplateSchema }), asyncHandler(c.saveTemplate));
  router.delete("/templates/:id", requirePermission("proposal.template"), asyncHandler(c.removeTemplate));
  router.post("/delete", validate({ body: deleteProposalsSchema }), asyncHandler(c.removeFinished));
  router.post("/:id/decision", validate({ body: decideProposalSchema }), asyncHandler(c.decide));
  return router;
}
