import type { Request, Response } from "express";
import { AppError } from "../lib/errors";
import type { NotificationService } from "../services/notification.service";

function userId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
  return id;
}

export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  list = async (req: Request, res: Response) => {
    res.status(200).json({ notifications: await this.notifications.list(userId(req)) });
  };

  unreadCount = async (req: Request, res: Response) => {
    res.status(200).json({ count: await this.notifications.unreadCount(userId(req)) });
  };

  markRead = async (req: Request, res: Response) => {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    await this.notifications.markRead(userId(req), id ?? "");
    res.status(204).end();
  };

  markAllRead = async (req: Request, res: Response) => {
    const updated = await this.notifications.markAllRead(userId(req));
    res.status(200).json({ updated });
  };
}
