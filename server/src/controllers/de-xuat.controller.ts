import type { Request, Response } from "express";
import type { ProposalRecord, PublicUser } from "@speego/shared";
import type { PostgresDeXuatRepository } from "../adapters/postgres/de-xuat.repository";
import { can } from "../config/permissions";
import { AppError } from "../lib/errors";
import type { NotificationService } from "../services/notification.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const idParam = (req: Request): string => {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !UUID.test(id)) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
  return id;
};

const href = (id: string) => `/de-xuat?id=${id}`;

export class DeXuatController {
  constructor(
    private readonly repo: PostgresDeXuatRepository | null,
    private readonly notifications: NotificationService | null = null,
  ) {}

  private ready(): PostgresDeXuatRepository {
    if (!this.repo) throw new AppError(503, "UNAVAILABLE", "Đề xuất cần kết nối Postgres");
    return this.repo;
  }

  private actor(req: Request): PublicUser {
    if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    return req.user;
  }

  /** Thông báo không làm hỏng thao tác đã lưu. */
  private notify(actor: PublicUser, ids: readonly string[], p: ProposalRecord, title: string, body: string) {
    return this.notifications
      ?.notifyUsers(ids, { type: "proposal", title, body, href: href(p.id), refType: "de-xuat", refId: p.id, actorId: actor.id })
      .catch(() => undefined);
  }

  users = async (_req: Request, res: Response) => {
    res.status(200).json({ users: await this.ready().users() });
  };

  /** scope=all (tab Quản trị / Thống kê) chỉ dành cho người có quyền xem toàn bộ. */
  list = async (req: Request, res: Response) => {
    const actor = this.actor(req);
    const all = req.query.scope === "all";
    if (all && !can(actor.role, "proposal.review")) throw new AppError(403, "FORBIDDEN", "Bạn không có quyền xem tất cả đề xuất");
    res.status(200).json({ rows: await this.ready().list(all ? null : actor.id) });
  };

  templates = async (_req: Request, res: Response) => {
    res.status(200).json({ templates: await this.ready().templates() });
  };

  create = async (req: Request, res: Response) => {
    const actor = this.actor(req);
    const row = await this.ready().create(actor, req.body);
    await this.notify(actor, [row.steps[0]!.approverId], row, "Đề xuất chờ bạn duyệt", `${actor.name} gửi "${row.subject}" (${row.code}).`);
    await this.notify(actor, row.followers.map((f) => f.id), row, "Bạn được theo dõi một đề xuất", `${actor.name} gửi "${row.subject}" (${row.code}).`);
    res.status(201).json({ row });
  };

  decide = async (req: Request, res: Response) => {
    const actor = this.actor(req);
    const row = await this.ready().decide(actor, idParam(req), req.body.decision, req.body.comment);
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
    if (row.status === "cho-duyet") {
      await this.notify(actor, [row.steps[row.currentStep]!.approverId], row, "Đề xuất chờ bạn duyệt", `${row.requesterName} gửi "${row.subject}" (${row.code}).`);
    } else {
      const approved = row.status === "da-duyet";
      await this.notify(actor, [row.requesterId, ...row.followers.map((f) => f.id)], row,
        approved ? "Đề xuất đã được duyệt" : "Đề xuất bị từ chối", `${actor.name} ${approved ? "đã duyệt" : "đã từ chối"} "${row.subject}" (${row.code}).`);
    }
    res.status(200).json({ row });
  };

  removeFinished = async (req: Request, res: Response) => {
    const actor = this.actor(req);
    const removed = await this.ready().removeFinished(req.body.ids, actor.role === "admin" ? null : actor.id);
    res.status(200).json({ removed });
  };

  saveTemplate = async (req: Request, res: Response) => {
    const raw = req.params.id;
    const recordId = raw ? idParam(req) : null;
    res.status(recordId ? 200 : 201).json({ template: await this.ready().saveTemplate(this.actor(req), req.body, recordId) });
  };

  removeTemplate = async (req: Request, res: Response) => {
    if (!(await this.ready().removeTemplate(idParam(req)))) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
    res.status(204).end();
  };
}
