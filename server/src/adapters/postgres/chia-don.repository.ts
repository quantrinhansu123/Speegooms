import type { AssignmentDesk, AssignmentMember, CrmLane } from "@speego/shared";
import type pg from "pg";
import { pickNextAssignee } from "../../config/chia-don";

type MemberRow = { id: string; name: string; manual_off: boolean; on_leave: boolean };

/** Off = bật tay, hoặc có đơn nghỉ phép (Đề xuất) đã duyệt phủ ngày hôm nay; nghỉ nửa ngày vẫn nhận đơn. */
const membersSql = `
  select m.nguoi_dung_id as id, u.ho_ten as name, m.off_thu_cong as manual_off,
         exists (
           select 1 from app.de_xuat d
           where d.nguoi_tao_id = m.nguoi_dung_id and d.loai = 'nghi-phep' and d.trang_thai = 'da-duyet'
             and coalesce(d.chi_tiet->>'duration', 'full') <> 'half'
             and (now() at time zone 'Asia/Ho_Chi_Minh')::date
                 between (d.chi_tiet->>'startDate')::date and (d.chi_tiet->>'endDate')::date
         ) as on_leave
  from crm.chia_don_nguoi_nhan m join public.nguoi_dung u on u.ma_nguoi_dung = m.nguoi_dung_id
  where m.ban = $1 order by m.thu_tu`;

const toMember = (r: MemberRow): AssignmentMember => ({
  id: r.id,
  name: r.name,
  off: r.manual_off || r.on_leave,
  offReason: r.on_leave ? "leave" : r.manual_off ? "manual" : null,
});

export class PostgresAssignmentRepository {
  constructor(private readonly pool: pg.Pool) {}

  async members(desk: AssignmentDesk): Promise<AssignmentMember[]> {
    return (await this.pool.query<MemberRow>(membersSql, [desk])).rows.map(toMember);
  }

  async setOff(desk: AssignmentDesk, userId: string, off: boolean): Promise<boolean> {
    const r = await this.pool.query(`update crm.chia_don_nguoi_nhan set off_thu_cong = $3 where ban = $1 and nguoi_dung_id = $2`, [desk, userId, off]);
    return (r.rowCount ?? 0) > 0;
  }

  /** quoteId → người phụ trách của một tuyến + bàn. */
  async assignees(lane: CrmLane, desk: AssignmentDesk): Promise<Record<string, { id: string; name: string }>> {
    const r = await this.pool.query<{ quote_id: string; id: string; name: string }>(
      `select a.bao_gia_id::text as quote_id, a.nguoi_nhan_id as id, u.ho_ten as name
       from crm.chia_don a join public.nguoi_dung u on u.ma_nguoi_dung = a.nguoi_nhan_id where a.tuyen = $1 and a.ban = $2`,
      [lane, desk],
    );
    return Object.fromEntries(r.rows.map((row) => [row.quote_id, { id: row.id, name: row.name }]));
  }

  /**
   * Chia báo giá cho người kế tiếp theo vòng tròn (đã chia rồi thì trả lại đúng người đó). Null nếu mọi người đang off
   * hoặc bàn chưa có danh sách nhận; khi đó chưa ghi gì để lần sau chia lại.
   */
  async assign(lane: CrmLane, desk: AssignmentDesk, quoteId: string): Promise<{ id: string; name: string } | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`chia_don_${desk}`]);
      const existing = (await client.query<{ id: string | null; name: string | null }>(
        `select a.nguoi_nhan_id as id, u.ho_ten as name from crm.chia_don a left join public.nguoi_dung u on u.ma_nguoi_dung = a.nguoi_nhan_id
         where a.tuyen = $1 and a.ban = $2 and a.bao_gia_id = $3::uuid`,
        [lane, desk, quoteId],
      )).rows[0];
      if (existing?.id && existing.name) {
        await client.query("commit");
        return { id: existing.id, name: existing.name };
      }
      const members = (await client.query<MemberRow>(membersSql, [desk])).rows.map(toMember);
      const last = (await client.query<{ id: string }>(
        `select nguoi_nhan_id as id from crm.chia_don where ban = $1 and nguoi_nhan_id is not null order by phan_cong_luc desc limit 1`,
        [desk],
      )).rows[0];
      const pickedId = pickNextAssignee(members.map((m) => m.id), new Set(members.filter((m) => !m.off).map((m) => m.id)), last?.id ?? null);
      const picked = members.find((m) => m.id === pickedId);
      if (!picked) {
        await client.query("commit");
        return null;
      }
      await client.query(
        `insert into crm.chia_don (tuyen, ban, bao_gia_id, nguoi_nhan_id) values ($1, $2, $3::uuid, $4)
         on conflict (tuyen, ban, bao_gia_id) do update set nguoi_nhan_id = excluded.nguoi_nhan_id, phan_cong_luc = now()`,
        [lane, desk, quoteId, picked.id],
      );
      await client.query("commit");
      return { id: picked.id, name: picked.name };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
