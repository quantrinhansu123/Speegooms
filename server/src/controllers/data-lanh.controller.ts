import type { Request, Response } from "express";
import type { PostgresDataLanhRepository } from "../adapters/postgres/data-lanh.repository";
import { AppError } from "../lib/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DataLanhController {
  constructor(private readonly repo: PostgresDataLanhRepository | null) {}

  private ready(): PostgresDataLanhRepository {
    if (!this.repo) throw new AppError(503, "UNAVAILABLE", "Data lạnh cần kết nối Postgres");
    return this.repo;
  }

  /** Intern chỉ thấy và sửa dòng của mình; các vai trò khác thấy tất cả. */
  private scope(req: Request): string | null {
    if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    return req.user.role === "sale-intern" ? req.user.id : null;
  }

  list = async (req: Request, res: Response) => {
    res.status(200).json({ rows: await this.ready().list(this.scope(req)) });
  };

  create = async (req: Request, res: Response) => {
    res.status(201).json({ row: await this.ready().create(req.body) });
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
