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

  create = async (req: Request, res: Response) => {
    res.status(201).json({ user: await this.admin.create(req.body) });
  };

  update = async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    res.status(200).json({ user: await this.admin.update(req.user.id, one(req.params.id), req.body) });
  };

  delete = async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    await this.admin.delete(req.user.id, one(req.params.id));
    res.status(204).end();
  };

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
