import express, { Router } from "express";
import { createDataLanhSchema, handoverDataLanhSchema, updateDataLanhSchema } from "@speego/shared";
import type { AppContainer } from "../container";
import { asyncHandler } from "../lib/async-handler";
import { requirePermission } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";

export function dataLanhRoutes(container: AppContainer) {
  const router = Router();
  const c = container.dataLanhController;
  router.use(container.authenticate);
  router.get("/", requirePermission("datalanh.read"), asyncHandler(c.list));
  router.post("/", requirePermission("datalanh.create"), validate({ body: createDataLanhSchema }), asyncHandler(c.create));
  router.get("/export", requirePermission("datalanh.read"), asyncHandler(c.exportExcel));
  router.post("/import", requirePermission("datalanh.create"), express.raw({
    type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"], limit: "20mb",
  }), asyncHandler(c.importExcel));
  router.get("/sales", requirePermission("datalanh.handover"), asyncHandler(c.sales));
  router.post("/assign", requirePermission("datalanh.assign"), asyncHandler(c.assign));
  router.post("/:id/handover", requirePermission("datalanh.handover"), validate({ body: handoverDataLanhSchema }), asyncHandler(c.handover));
  router.patch("/:id", requirePermission("datalanh.work"), validate({ body: updateDataLanhSchema }), asyncHandler(c.update));
  router.delete("/:id", requirePermission("datalanh.delete"), asyncHandler(c.remove));
  return router;
}
