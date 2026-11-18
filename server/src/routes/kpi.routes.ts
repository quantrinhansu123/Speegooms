import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler } from "../lib/async-handler";

export function kpiRoutes(c: AppContainer) {
  const r = Router();
  r.use(c.authenticate);
  r.get("/", asyncHandler(c.kpiController.list));
  r.post("/", asyncHandler(c.kpiController.create));
  r.put("/:id", asyncHandler(c.kpiController.update));
  return r;
}
