import type { Request, Response } from "express";
import type { PostgresDataLanhRepository } from "../adapters/postgres/data-lanh.repository";
import { AppError } from "../lib/errors";
import type { NotificationService } from "../services/notification.service";
import { dataLanhWorkbook, importDataLanhWorkbook } from "../services/data-lanh-excel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DataLanhController {
  constructor(
    private readonly repo: PostgresDataLanhRepository | null,
    private readonly notifications: NotificationService | null = null,
  ) {}

  private ready(): PostgresDataLanhRepository {
    if (!this.repo) throw new AppError(503, "UNAVAILABLE", "Data khách hàng cần kết nối Postgres");
    return this.repo;
  }

  /** Admin, Ban GĐ và trưởng Sale Global thấy tất cả; người khác chỉ thấy khách được giao hoặc được bàn giao cho mình. */
  private scope(req: Request): string | null {
    if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    return req.user.role === "admin" || req.user.role === "ban-gd" || req.user.role === "sale-global-lead" ? null : req.user.id;
  }

  list = async (req: Request, res: Response) => {
    res.status(200).json({ rows: await this.ready().list(this.scope(req)) });
  };

  sales = async (_req: Request, res: Response) => {
    res.status(200).json({ sales: await this.ready().listSales() });
  };

  handover = async (req: Request, res: Response) => {
    const actor = req.user;
    if (!actor) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id || !UUID.test(id)) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
    const row = await this.ready().handover(id, req.body.saleId, actor.id, this.scope(req));
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
    // Thông báo lỗi không làm hỏng việc bàn giao đã lưu.
    await this.notifications?.notifyDataLanhHandover(actor, req.body.saleId, row.fullName ?? `STT ${row.stt}`, row.id).catch(() => undefined);
    res.status(200).json({ row });
  };

  create = async (req: Request, res: Response) => {
    res.status(201).json({ row: await this.ready().create(req.body, this.scope(req)) });
  };

  exportExcel = async (req: Request, res: Response) => {
    const rows = req.query.template === "1" ? [] : await this.ready().list(this.scope(req), null);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="data-khach-hang.xlsx"');
    res.status(200).send(await dataLanhWorkbook(rows));
  };

  importExcel = async (req: Request, res: Response) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new AppError(422, "VALIDATION_ERROR", "Chọn file Excel .xlsx");
    const repo = this.ready();
    const ownerId = this.scope(req);
    res.status(200).json(await importDataLanhWorkbook(req.body, inputs => repo.importRows(inputs, ownerId)));
  };

  remove = async (req: Request, res: Response) => {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id || !UUID.test(id)) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
    if (!(await this.ready().remove(id))) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
    res.status(204).end();
  };

  update = async (req: Request, res: Response) => {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id || !UUID.test(id)) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
    const row = await this.ready().update(id, req.body, this.scope(req));
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
    res.status(200).json({ row });
  };

  assign = async (_req: Request, res: Response) => {
    res.status(200).json(await this.ready().assignRoundRobin());
  };
}
