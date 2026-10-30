import type { CrmLane, PublicUser, QuoteDesk, Role } from "@speego/shared";
import { AppError } from "../lib/errors";
import type { NotificationDraft, NotificationRecord, NotificationRepository } from "../repositories/notification.repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function salePath(lane: CrmLane, suffix: "rfq" | "hop-dong"): string {
  return lane === "vn" ? `/sale-viet-nam/${suffix}` : `/sale-global/${suffix}`;
}

function deskPath(desk: QuoteDesk): string {
  return desk === "logistics" ? "/van-hanh/logistics-bao-gia" : "/van-hanh/sourcing-bao-gia";
}

/** Deep-link tới đúng bản ghi trên trang danh sách (`?id=` + `lane` khi cần). */
function recordHref(path: string, id: string, lane?: CrmLane): string {
  const query = new URLSearchParams({ id });
  if (lane) query.set("lane", lane);
  return `${path}?${query}`;
}

function laneLabel(lane: CrmLane): string {
  return lane === "vn" ? "Việt Nam" : "Global";
}

export class NotificationService {
  constructor(private readonly notifications: NotificationRepository | null) {}

  list(userId: string): Promise<NotificationRecord[]> {
    return this.ready().listForUser(userId, 30);
  }

  unreadCount(userId: string): Promise<number> {
    return this.ready().unreadCount(userId);
  }

  async markRead(userId: string, id: string): Promise<void> {
    if (!UUID.test(id)) throw new AppError(404, "NOT_FOUND", "Không tìm thấy thông báo");
    const ok = await this.ready().markRead(userId, id);
    if (!ok) throw new AppError(404, "NOT_FOUND", "Không tìm thấy thông báo");
  }

  async markAllRead(userId: string): Promise<number> {
    return this.ready().markAllRead(userId);
  }

  async notifyRoles(input: {
    roles: readonly Role[];
    excludeUserId?: string | null;
    draft: NotificationDraft;
  }): Promise<void> {
    if (!this.notifications) return;
    const ids = await this.notifications.listUserIdsByRoles(input.roles);
    const recipients = [...new Set(ids)].filter((id) => id !== input.excludeUserId);
    if (recipients.length === 0) return;
    await this.notifications.createMany(recipients, input.draft);
  }

  async notifyQuoteRequested(actor: PublicUser, lane: CrmLane, desk: QuoteDesk, quoteCode: string, quoteId: string): Promise<void> {
    await this.notifyRoles({
      roles: ["van-hanh", "admin"],
      excludeUserId: actor.id,
      draft: {
        type: "quote.request",
        title: "Yêu cầu báo giá mới",
        body: `${actor.name} yêu cầu báo giá ${quoteCode} (${desk}, ${laneLabel(lane)}).`,
        href: recordHref(deskPath(desk), quoteId, lane),
        lane,
        refType: "quote",
        refId: quoteId,
        actorId: actor.id,
      },
    });
  }

  async notifyQuoteSent(actor: PublicUser, lane: CrmLane, desk: QuoteDesk, quoteCode: string, quoteId: string): Promise<void> {
    const saleRole: Role = lane === "vn" ? "sale-vn" : "sale-global";
    await this.notifyRoles({
      roles: [saleRole, "admin"],
      excludeUserId: actor.id,
      draft: {
        type: "quote.send",
        title: "Báo giá đã gửi",
        body: `${actor.name} đã gửi báo giá ${quoteCode} (${desk}, ${laneLabel(lane)}).`,
        href: recordHref(salePath(lane, "rfq"), quoteId, lane),
        lane,
        refType: "quote",
        refId: quoteId,
        actorId: actor.id,
      },
    });
  }

  async notifyQuoteReturned(actor: PublicUser, lane: CrmLane, desk: QuoteDesk, quoteCode: string, quoteId: string): Promise<void> {
    await this.notifyRoles({
      roles: ["van-hanh", "admin"],
      excludeUserId: actor.id,
      draft: {
        type: "quote.return",
        title: "Yêu cầu làm lại báo giá",
        body: `${actor.name} gửi lại báo giá ${quoteCode} (${desk}, ${laneLabel(lane)}).`,
        href: recordHref(deskPath(desk), quoteId, lane),
        lane,
        refType: "quote",
        refId: quoteId,
        actorId: actor.id,
      },
    });
  }

  async notifyContractCreated(actor: PublicUser, lane: CrmLane, contractCode: string, contractId: string): Promise<void> {
    await this.notifyRoles({
      roles: ["van-hanh", "admin"],
      excludeUserId: actor.id,
      draft: {
        type: "contract.create",
        title: "Hợp đồng mới",
        body: `${actor.name} tạo hợp đồng ${contractCode} (${laneLabel(lane)}).`,
        href: recordHref("/van-hanh/don-hang", contractId, lane),
        lane,
        refType: "contract",
        refId: contractId,
        actorId: actor.id,
      },
    });
  }

  async notifyContractResent(
    actor: PublicUser,
    lane: CrmLane,
    target: "ops" | "accounting" | "parties",
    contractCode: string,
    contractId: string,
  ): Promise<void> {
    if (target === "ops") {
      await this.notifyRoles({
        roles: ["van-hanh", "admin"],
        excludeUserId: actor.id,
        draft: {
          type: "contract.resend.ops",
          title: "Hợp đồng gửi Vận hành",
          body: `${actor.name} gửi lại hợp đồng ${contractCode} cho Vận hành (${laneLabel(lane)}).`,
          href: recordHref("/van-hanh/don-hang", contractId, lane),
          lane,
          refType: "contract",
          refId: contractId,
          actorId: actor.id,
        },
      });
      return;
    }
    if (target === "accounting") {
      await this.notifyRoles({
        roles: ["ke-toan", "admin"],
        excludeUserId: actor.id,
        draft: {
          type: "contract.resend.accounting",
          title: "Hợp đồng gửi Kế toán",
          body: `${actor.name} gửi lại hợp đồng ${contractCode} cho Kế toán (${laneLabel(lane)}).`,
          href: recordHref("/ke-toan/hop-dong", contractId, lane),
          lane,
          refType: "contract",
          refId: contractId,
          actorId: actor.id,
        },
      });
      return;
    }
    const saleRole: Role = lane === "vn" ? "sale-vn" : "sale-global";
    const body = `${actor.name} gửi lại hợp đồng ${contractCode} cho Sale và Vận hành (${laneLabel(lane)}).`;
    await this.notifyRoles({
      roles: [saleRole, "admin"],
      excludeUserId: actor.id,
      draft: {
        type: "contract.resend.parties",
        title: "Kế toán xác nhận hợp đồng",
        body,
        href: recordHref(salePath(lane, "hop-dong"), contractId, lane),
        lane,
        refType: "contract",
        refId: contractId,
        actorId: actor.id,
      },
    });
    await this.notifyRoles({
      roles: ["van-hanh"],
      excludeUserId: actor.id,
      draft: {
        type: "contract.resend.parties",
        title: "Kế toán xác nhận hợp đồng",
        body,
        href: recordHref("/van-hanh/don-hang", contractId, lane),
        lane,
        refType: "contract",
        refId: contractId,
        actorId: actor.id,
      },
    });
  }

  private ready(): NotificationRepository {
    if (!this.notifications) throw new AppError(503, "UNAVAILABLE", "Thông báo cần kết nối Postgres");
    return this.notifications;
  }
}
