import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import type { AppContainer } from "../container";

export function notificationRoutes(container: AppContainer) {
  const router = Router();
  const notifications = container.notificationController;
  router.use(container.authenticate);
  router.get("/", asyncHandler(notifications.list));
  router.get("/unread-count", asyncHandler(notifications.unreadCount));
  router.post("/read-all", asyncHandler(notifications.markAllRead));
  router.post("/:id/read", asyncHandler(notifications.markRead));
  return router;
}
