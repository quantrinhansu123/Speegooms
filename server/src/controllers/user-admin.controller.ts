import type { Request, Response } from "express";
import { AppError } from "../lib/errors";
import type { UserAdminService } from "../services/user-admin.service";

function one(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new AppError(404, "NOT_FOUND", "Không tìm thấy tài khoản");
  return id;
}

export class UserAdminController {
  constructor(private readonly admin: UserAdminService) {}

  list = async (_req: Request, res: Response) => {
    res.status(200).json({ users: await this.admin.list() });
  };

  updateRole = async (req: Request, res: Response) => {
    const actorId = req.user?.id;
    if (!actorId) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    const user = await this.admin.updateRole(actorId, one(req.params.id), req.body.role);
    res.status(200).json({ user });
  };
}
