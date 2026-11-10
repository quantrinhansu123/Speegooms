import type { Request, Response } from "express";
import { assignmentDeskSchema, canAccessQuoteDesk } from "@speego/shared";
import type { PostgresAssignmentRepository } from "../adapters/postgres/chia-don.repository";
import { can } from "../config/permissions";
import { AppError } from "../lib/errors";

export class AssignmentController {
  constructor(private readonly repo: PostgresAssignmentRepository | null) {}

  private ready(): PostgresAssignmentRepository {
    if (!this.repo) throw new AppError(503, "UNAVAILABLE", "Chia đơn cần kết nối Postgres");
    return this.repo;
  }

  private desk(req: Request) {
    const parsed = assignmentDeskSchema.safeParse(req.params.desk);
    if (!parsed.success) throw new AppError(404, "NOT_FOUND", "Không tìm thấy bàn");
    return parsed.data;
  }

  members = async (req: Request, res: Response) => {
    res.status(200).json({ members: await this.ready().members(this.desk(req)) });
  };

  assignees = async (req: Request, res: Response) => {
    const actor = req.user;
    if (!actor) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    const lane = req.query.lane === "global" ? "global" : "vn";
    const desk = this.desk(req);
    if (!canAccessQuoteDesk(actor.role, desk) && !can(actor.role, "quote.rfq")) {
      throw new AppError(403, "FORBIDDEN", "Không có quyền xem bàn báo giá này");
    }
    let assignees = await this.ready().assignees(lane, desk);
    if (actor.role === "sourcing" || actor.role === "logistics") {
      const own = desk === actor.role ? assignees : await this.ready().assignees(lane, actor.role);
      assignees = Object.fromEntries(Object.entries(assignees).filter(([id]) => own[id]?.id === actor.id));
    }
    res.status(200).json({ assignees });
  };

  /** Admin / Trưởng nhóm Vận hành chỉnh cho bất kỳ ai; mỗi người luôn tự bật/tắt off của mình. */
  setOff = async (req: Request, res: Response) => {
    const actor = req.user;
    if (!actor) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    const raw = req.params.userId;
    const userId = Array.isArray(raw) ? raw[0] : raw;
    if (!userId) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
    if (userId !== actor.id && !can(actor.role, "quote.assign")) {
      throw new AppError(403, "FORBIDDEN", "Bạn chỉ được đổi trạng thái off của chính mình");
    }
    const desk = this.desk(req);
    if (!(await this.ready().setOff(desk, userId, req.body.off))) {
      throw new AppError(404, "NOT_FOUND", "Người này không nằm trong danh sách chia đơn");
    }
    res.status(200).json({ members: await this.ready().members(desk) });
  };
}
