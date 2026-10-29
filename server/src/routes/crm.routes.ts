import { Router } from "express";
import { createMessageSchema, updateMessageSchema, updatePotentialSchema } from "@speego/shared";
import { asyncHandler } from "../lib/async-handler";
import { requirePermission } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import type { AppContainer } from "../container";

export function crmRoutes(container: AppContainer) {
  const router = Router();
  const crm = container.crmController;
  router.use(container.authenticate);
  router.get("/messages", requirePermission("message.read"), asyncHandler(crm.listMessages));
  router.post("/messages", requirePermission("message.write"), validate({ body: createMessageSchema }), asyncHandler(crm.createMessage));
  router.patch("/messages/:id", requirePermission("message.write"), validate({ body: updateMessageSchema }), asyncHandler(crm.updateMessage));
  router.delete("/messages/:id", requirePermission("message.write"), asyncHandler(crm.deleteMessage));
  router.post("/messages/:id/convert", requirePermission("message.convert"), asyncHandler(crm.convertMessage));
  router.get("/potentials", requirePermission("potential.read"), asyncHandler(crm.listPotentials));
  router.patch("/potentials/:id", requirePermission("potential.write"), validate({ body: updatePotentialSchema }), asyncHandler(crm.updatePotential));
  router.delete("/potentials/:id", requirePermission("potential.write"), asyncHandler(crm.deletePotential));
  return router;
}
