import { manageableTargetDepartments, setTargetsSchema, targetQuerySchema } from "@speego/shared";
import type { Request, Response } from "express";
import { TargetInputError, type PostgresTargetsRepository } from "../adapters/postgres/targets.repository";
import { AppError } from "../lib/errors";

export class TargetsController {
  constructor(private readonly repo: PostgresTargetsRepository | null) {}

  private actor(req: Request, department?: string) {
    if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    const allowed = manageableTargetDepartments(req.user.role);
    if (allowed.length === 0 || (department && !(allowed as readonly string[]).includes(department))) {
      throw new AppError(403, "FORBIDDEN", "Không có quyền giao mục tiêu cho nhóm này");
    }
    return req.user;
  }

  private ready() {
    if (!this.repo) throw new AppError(503, "UNAVAILABLE", "Giao mục tiêu cần kết nối Postgres");
    return this.repo;
  }

  /** Nhóm người dùng hiện tại được giao mục tiêu. */
  scope = async (req: Request, res: Response) => {
    res.json({ departments: manageableTargetDepartments(this.actor(req).role) });
  };

  read = async (req: Request, res: Response) => {
    const query = targetQuerySchema.safeParse(req.query);
    if (!query.success) throw new AppError(400, "INVALID", query.error.issues[0]!.message);
    this.actor(req, query.data.department);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await this.ready().grid(query.data.department, query.data.period, query.data.start));
  };

  write = async (req: Request, res: Response) => {
    const body = setTargetsSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, "INVALID", body.error.issues[0]!.message);
    const actor = this.actor(req, body.data.department);
    try {
      await this.ready().set(body.data.department, body.data.period, body.data.start, body.data.rows, actor.id);
    } catch (error) {
      if (error instanceof TargetInputError) throw new AppError(400, "INVALID", error.message);
      throw error;
    }
    res.json(await this.ready().grid(body.data.department, body.data.period, body.data.start));
  };
}
