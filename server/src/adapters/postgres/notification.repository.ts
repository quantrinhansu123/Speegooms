import type { Role } from "@speego/shared";
import type pg from "pg";
import { InfrastructureError } from "../../lib/errors";
import { contractOwnerSql, crmTables, leadOwnerSql, quoteOwnerSql } from "./crm-sale-scope";
import type {
  NotificationDraft,
  NotificationRecord,
  NotificationRepository,
} from "../../repositories/notification.repository";

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string;
  href: string;
  lane: string | null;
  ref_type: string | null;
  ref_id: string | null;
  read: boolean;
  read_at: Date | string | null;
  created_at: Date | string;
};

function stamp(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    lane: row.lane === "vn" || row.lane === "global" ? row.lane : null,
    refType: row.ref_type,
    refId: row.ref_id,
    read: row.read,
    readAt: stamp(row.read_at),
    createdAt: stamp(row.created_at) ?? new Date().toISOString(),
  };
}

function crmNotificationOwnerSql(tables: typeof crmTables[keyof typeof crmTables]): string {
  const reference = "(case when n.tham_chieu_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then n.tham_chieu_id::uuid end)";
  return `case n.tham_chieu_loai
    when 'quote' then ${quoteOwnerSql(tables, reference, true)}
    when 'potential' then (select ${leadOwnerSql("l")} from ${tables.potential} l where l.id = ${reference} and l.xoa_luc is null)
    when 'contract' then (select ${contractOwnerSql(tables, "h")} from crm.hop_dong h where h.id = ${reference} and h.tuyen = n.tuyen)
  end`;
}

const visibleNotification = `case when n.tham_chieu_loai in ('quote', 'potential', 'contract') then
  case (select vai_tro from public.nguoi_dung where ma_nguoi_dung = n.nguoi_nhan_id)
    when 'sale-vn' then n.tuyen = 'vn' and n.nguoi_nhan_id = (${crmNotificationOwnerSql(crmTables.vn)})
    when 'sale-global' then n.tuyen = 'global' and n.nguoi_nhan_id = (${crmNotificationOwnerSql(crmTables.global)})
    else true
  end
  else true
end`;

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listForUser(userId: string, limit = 30): Promise<NotificationRecord[]> {
    const result = await this.query<NotificationRow>(
      `select id::text as id, nguoi_nhan_id as recipient_id, nguoi_gui_id as actor_id,
              loai as type, tieu_de as title, noi_dung as body, duong_dan as href,
              tuyen as lane, tham_chieu_loai as ref_type, tham_chieu_id as ref_id,
              da_xem as read, xem_luc as read_at, tao_luc as created_at
       from app.thong_bao n
       where nguoi_nhan_id = $1 and (${visibleNotification})
       order by tao_luc desc
       limit $2`,
      [userId, Math.min(Math.max(limit, 1), 100)],
    );
    return result.rows.map(toRecord);
  }

  async unreadCount(userId: string): Promise<number> {
    const result = await this.query<{ count: string }>(
      `select count(*)::text as count from app.thong_bao n where nguoi_nhan_id = $1 and da_xem = false and (${visibleNotification})`,
      [userId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const result = await this.query<{ id: string }>(
      `update app.thong_bao n
       set da_xem = true, xem_luc = coalesce(xem_luc, now())
       where id = $1::uuid and nguoi_nhan_id = $2 and (${visibleNotification})
       returning id::text as id`,
      [id, userId],
    );
    return Boolean(result.rows[0]);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.query<{ count: string }>(
      `with updated as (
         update app.thong_bao n
         set da_xem = true, xem_luc = coalesce(xem_luc, now())
         where nguoi_nhan_id = $1 and da_xem = false and (${visibleNotification})
         returning 1
       )
       select count(*)::text as count from updated`,
      [userId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async listUserIdsByRoles(roles: readonly Role[]): Promise<string[]> {
    if (roles.length === 0) return [];
    const result = await this.query<{ id: string }>(
      `select ma_nguoi_dung as id from nguoi_dung where vai_tro = any($1::text[])`,
      [roles],
    );
    return result.rows.map((row) => row.id);
  }

  async createMany(allRecipientIds: readonly string[], draft: NotificationDraft): Promise<number> {
    let recipientIds = allRecipientIds;
    if (draft.skipIfUnread && draft.refType && draft.refId && recipientIds.length > 0) {
      const unread = await this.query<{ id: string }>(
        `select nguoi_nhan_id as id from app.thong_bao
         where da_xem = false and loai = $1 and tham_chieu_loai = $2 and tham_chieu_id = $3 and nguoi_nhan_id = any($4::text[])
           and duong_dan = $5`,
        [draft.type, draft.refType, draft.refId, recipientIds, draft.href],
      );
      const skip = new Set(unread.rows.map((row) => row.id));
      recipientIds = recipientIds.filter((id) => !skip.has(id));
    }
    if (recipientIds.length === 0) return 0;
    const values: unknown[] = [];
    const rows: string[] = [];
    recipientIds.forEach((recipientId, index) => {
      const base = index * 10;
      rows.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`,
      );
      values.push(
        recipientId,
        draft.actorId ?? null,
        draft.type,
        draft.title,
        draft.body,
        draft.href,
        draft.lane ?? null,
        draft.refType ?? null,
        draft.refId ?? null,
        false,
      );
    });
    const result = await this.query<{ id: string }>(
      `insert into app.thong_bao (
         nguoi_nhan_id, nguoi_gui_id, loai, tieu_de, noi_dung, duong_dan,
         tuyen, tham_chieu_loai, tham_chieu_id, da_xem
       )
       values ${rows.join(", ")}
       returning id::text as id`,
      values,
    );
    return result.rows.length;
  }

  private async query<T extends pg.QueryResultRow>(sql: string, params: readonly unknown[]): Promise<pg.QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (cause) {
      throw new InfrastructureError("database query failed", { cause });
    }
  }
}
