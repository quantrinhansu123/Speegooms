import type { Request, Response } from "express";
import { z } from "zod";
import { createKpiSchema, updateKpiSchema, kpiDepartmentSchema, canManageKpis, manageableKpiDepartments, type KpiDepartment } from "@speego/shared";
import type { PostgresKpiRepository } from "../adapters/postgres/kpi.repository";
import { AppError } from "../lib/errors";

export class KpiController {
  constructor(private readonly repo: PostgresKpiRepository | null) {}

  private actor(req: Request, department?: KpiDepartment) {
    if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    if (!canManageKpis(req.user.role) || (department && !manageableKpiDepartments(req.user.role).includes(department))) {
      throw new AppError(403, "FORBIDDEN", "Không có quyền cấu hình KPI cho phòng ban này");
    }
    return req.user;
  }

  private ready() {
    if (!this.repo) throw new AppError(503, "UNAVAILABLE", "Cấu hình KPI cần kết nối Postgres");
    return this.repo;
  }

  private duplicate(error: unknown): never {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new AppError(409, "DUPLICATE_KPI", "Mã KPI đã tồn tại trong phòng ban này");
    }
    throw error;
  }

  list = async (req: Request, res: Response) => {
    const actor = this.actor(req);
    const parsed = z.object({ department: kpiDepartmentSchema.optional() }).safeParse(req.query);
    if (!parsed.success) throw new AppError(400, "INVALID", "Phòng ban không hợp lệ");
    const department = parsed.data.department;
    if (department) this.actor(req, department);
    res.json({ definitions: await this.ready().list(department ? [department] : manageableKpiDepartments(actor.role)) });
  };

  create = async (req: Request, res: Response) => {
    this.actor(req);
    const parsed = createKpiSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "INVALID", parsed.error.issues[0]!.message);
    const actor = this.actor(req, parsed.data.department);
    try {
      const definition = await this.ready().create(parsed.data, actor.id);
      res.status(201).json({ definition });
    } catch (error) { this.duplicate(error); }
  };

  update = async (req: Request, res: Response) => {
    this.actor(req);
    const id = z.string().uuid().safeParse(req.params.id);
    const parsed = updateKpiSchema.safeParse(req.body);
    if (!id.success) throw new AppError(400, "INVALID", "Mã bản ghi KPI không hợp lệ");
    if (!parsed.success) throw new AppError(400, "INVALID", parsed.error.issues[0]!.message);
    const actor = this.actor(req, parsed.data.department);
    try {
      const definition = await this.ready().update(id.data, parsed.data, actor.id);
      if (!definition) throw new AppError(409, "KPI_CONFLICT", "KPI đã thay đổi hoặc không còn trong phòng ban này. Tải lại danh sách trước khi sửa.");
      res.json({ definition });
    } catch (error) { this.duplicate(error); }
  };
}
