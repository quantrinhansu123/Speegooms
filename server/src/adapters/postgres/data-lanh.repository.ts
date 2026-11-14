import { facebookStatuses, telesaleStatuses, hasActiveTelesale, type CreateDataLanhInput, type DataLanhRecord, type DataLanhRecipient, type UpdateDataLanhInput } from "@speego/shared";
import type pg from "pg";
import { AppError } from "../../lib/errors";

type Row = {
  id: string; stt: number; full_name: string | null; company: string | null; phone: string | null;
  facebook_link: string | null; market: string | null; segment: string | null; customer_class: string | null;
  address: string | null; interest: string | null; history: string | null; note: string | null;
  intern_id: string | null; intern_name: string | null; facebook_status: string | null;
  telesale_status: string | null; assigned_at: Date | null;
  sale_care_id: string | null; sale_care_name: string | null; handed_over_at: Date | null;
};

const select = `
  select d.id::text as id, d.stt, d.ho_ten as full_name, d.ten_tiem as company, d.so_dien_thoai as phone,
         d.link_facebook as facebook_link, d.thi_truong as market, d.mang_kinh_doanh as segment,
         d.phan_loai_khach as customer_class, d.dia_chi as address, d.quan_tam as interest,
         d.lich_su_cskh as history, d.ghi_chu as note, d.intern_id, u.ho_ten as intern_name,
         d.trang_thai_facebook as facebook_status, d.trang_thai_telesale as telesale_status, d.giao_luc as assigned_at,
         d.sale_care_id, s.ho_ten as sale_care_name, d.ban_giao_luc as handed_over_at
  from crm.data_lanh d left join public.nguoi_dung u on u.ma_nguoi_dung = d.intern_id
  left join public.nguoi_dung s on s.ma_nguoi_dung = d.sale_care_id`;

const editableColumns = {
  facebookStatus: "trang_thai_facebook",
  telesaleStatus: "trang_thai_telesale",
  fullName: "ho_ten",
  company: "ten_tiem",
  phone: "so_dien_thoai",
  facebookLink: "link_facebook",
  market: "thi_truong",
  segment: "mang_kinh_doanh",
  address: "dia_chi",
  interest: "quan_tam",
  customerClass: "phan_loai_khach",
  history: "lich_su_cskh",
  note: "ghi_chu",
} as const;

const toRecord = (r: Row): DataLanhRecord => ({
  id: r.id, stt: r.stt, fullName: r.full_name, company: r.company, phone: r.phone, facebookLink: r.facebook_link,
  market: r.market, segment: r.segment, customerClass: r.customer_class, address: r.address, interest: r.interest,
  history: r.history, note: r.note, internId: r.intern_id, internName: r.intern_name,
  facebookStatus: r.facebook_status, telesaleStatus: r.telesale_status, assignedAt: r.assigned_at?.toISOString() ?? null,
  saleCareId: r.sale_care_id, saleCareName: r.sale_care_name, handedOverAt: r.handed_over_at?.toISOString() ?? null,
});

export class PostgresDataLanhRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listRecipients(): Promise<DataLanhRecipient[]> {
    return (await this.pool.query<DataLanhRecipient>(
      `select u.ma_nguoi_dung as id, u.ho_ten as name, u.thu_dien_tu as email
       from crm.data_lanh_nguoi_nhan p join public.nguoi_dung u on u.ma_nguoi_dung = p.nguoi_dung_id order by p.thu_tu`,
    )).rows;
  }

  async changeRecipient(userId: string, action: "add" | "remove"): Promise<{ assigned: number; interns: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext('data_lanh_assign'))");
      const recipients = (await client.query<{ id: string }>(
        `select nguoi_dung_id as id from crm.data_lanh_nguoi_nhan order by thu_tu`,
      )).rows.map(r => r.id);
      if (action === "add") {
        if (recipients.includes(userId)) throw new AppError(409, "CONFLICT", "Người này đã ở trong vòng nhận data");
        const user = (await client.query(
          `select ma_nguoi_dung from public.nguoi_dung where ma_nguoi_dung = $1 and vai_tro in ('sale-vn', 'sale-global', 'sale-intern') for share`, [userId],
        )).rows[0];
        if (!user) throw new AppError(422, "VALIDATION_ERROR", "Chọn tài khoản Sale hợp lệ");
        await client.query(
          `insert into crm.data_lanh_nguoi_nhan (nguoi_dung_id, thu_tu) select $1, coalesce(max(thu_tu), 0) + 1 from crm.data_lanh_nguoi_nhan`, [userId],
        );
        recipients.push(userId);
      } else {
        if (!recipients.includes(userId)) throw new AppError(404, "NOT_FOUND", "Người này không ở trong vòng nhận data");
        if (recipients.length === 1) throw new AppError(409, "CONFLICT", "Cần giữ ít nhất một người nhận data");
        await client.query(`delete from crm.data_lanh_nguoi_nhan where nguoi_dung_id = $1`, [userId]);
        recipients.splice(recipients.indexOf(userId), 1);
      }
      // shortcut: xét trạng thái hiện tại; cần lịch sử trạng thái nếu muốn giữ cả khách đã xử lý rồi đặt lại về 0.
      const rows = (await client.query<{ id: string }>(
        `select id::text as id from crm.data_lanh
         where coalesce(trang_thai_facebook, '') in ('', $1)
           and coalesce(trang_thai_telesale, '') in ('', $2)
           and sale_care_id is null and ban_giao_luc is null
         order by stt for update`, [facebookStatuses[0], telesaleStatuses[0]],
      )).rows;
      if (rows.length) {
        await client.query(
          `update crm.data_lanh d set intern_id = t.intern_id, giao_luc = now(), cap_nhat_luc = now()
           from unnest($1::uuid[], $2::text[]) as t(id, intern_id) where d.id = t.id`,
          [rows.map(r => r.id), rows.map((_, i) => recipients[i % recipients.length])],
        );
      }
      await client.query("commit");
      return { assigned: rows.length, interns: recipients.length };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** internId = chỉ lấy khách giao hoặc bàn giao cho người đó; null = tất cả. */
  async list(internId: string | null, limit: number | null = 2000): Promise<DataLanhRecord[]> {
    const result = await this.pool.query<Row>(`${select} where ($1::text is null or d.intern_id = $1 or d.sale_care_id = $1) order by d.stt limit $2`, [internId, limit]);
    return result.rows.map(toRecord);
  }

  /** Sale tự thêm thì nhận phụ trách; Admin thêm vào danh sách chờ chia. */
  async create(input: CreateDataLanhInput, ownerId: string | null = null): Promise<DataLanhRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      // Đồng bộ kiểm tra SĐT và cấp STT giữa các lượt tạo/import đồng thời.
      await client.query("select pg_advisory_xact_lock(hashtext('data_lanh_create'))");
      const digits = input.phone?.replace(/\D/g, "") ?? "";
      if (digits) {
        const dup = (await client.query<{ stt: number; name: string | null }>(
          `select stt, ho_ten as name from crm.data_lanh where regexp_replace(coalesce(so_dien_thoai, ''), '\\D', '', 'g') = $1 limit 1`,
          [digits],
        )).rows[0];
        if (dup) throw new AppError(409, "CONFLICT", "Số điện thoại đã tồn tại trong Data khách hàng");
      }
      const keys = (Object.keys(editableColumns) as (keyof typeof editableColumns)[]).filter((key) => key in input && key !== "facebookStatus" && key !== "telesaleStatus");
      const values = keys.map((key) => (input as Record<string, string | null | undefined>)[key]?.trim() || null);
      const inserted = await client.query<{ id: string }>(
        `insert into crm.data_lanh (stt, intern_id, giao_luc${keys.map((key) => `, ${editableColumns[key]}`).join("")})
         select coalesce(max(stt), 0) + 1, $1::text, case when $1::text is null then null else now() end${values.map((_, i) => `, $${i + 2}`).join("")} from crm.data_lanh
         returning id::text as id`,
        [ownerId, ...values],
      );
      const id = inserted.rows[0]!.id;
      const row = (await client.query<Row>(`${select} where d.id = $1::uuid`, [id])).rows.map(toRecord)[0]!;
      await client.query("commit");
      return row;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Import một lần trong transaction, bỏ SĐT trùng cả trong file lẫn danh sách hiện có. */
  async importRows(inputs: CreateDataLanhInput[], ownerId: string | null): Promise<{ created: number; skipped: number }> {
    if (!inputs.length) return { created: 0, skipped: 0 };
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext('data_lanh_create'))");
      const keys = (Object.keys(editableColumns) as (keyof typeof editableColumns)[]).filter(key => key !== "facebookStatus" && key !== "telesaleStatus");
      const inserted = await client.query(
        `with source as (
           select value, ordinality, regexp_replace(coalesce(value->>'phone', ''), '\\D', '', 'g') as digits
           from jsonb_array_elements($1::jsonb) with ordinality
         ), ranked as (
           select *, row_number() over (partition by case when digits = '' then 'row:' || ordinality::text else 'phone:' || digits end order by ordinality) as duplicate_number
           from source
         ), fresh as (
           select * from ranked r where duplicate_number = 1 and (digits = '' or not exists (
             select 1 from crm.data_lanh d where regexp_replace(coalesce(d.so_dien_thoai, ''), '\\D', '', 'g') = r.digits
           ))
         )
         insert into crm.data_lanh (stt, intern_id, giao_luc, ${keys.map(key => editableColumns[key]).join(", ")})
         select (select coalesce(max(stt), 0) from crm.data_lanh) + row_number() over (order by ordinality),
           $2::text, case when $2::text is null then null else now() end,
           ${keys.map(key => `nullif(value->>'${key}', '')`).join(", ")}
         from fresh order by ordinality returning id`,
        [JSON.stringify(inputs), ownerId],
      );
      await client.query("commit");
      const created = inserted.rowCount ?? 0;
      return { created, skipped: inputs.length - created };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Các Sale có thể nhận bàn giao. */
  async listSales(): Promise<{ id: string; name: string }[]> {
    const result = await this.pool.query<{ id: string; name: string }>(`select ma_nguoi_dung as id, ho_ten as name from public.nguoi_dung where vai_tro in ('sale-vn', 'sale-global', 'sale-global-lead') order by ho_ten`);
    return result.rows;
  }

  /**
   * Bàn giao khách cho Sale care. internId = người thao tác (null = Admin/Ban GĐ), chỉ bàn giao được khách của mình.
   * Trả null nếu không thấy dòng. Có thể bàn giao lại cho Sale khác.
   */
  async handover(id: string, saleId: string, actorId: string, internId: string | null): Promise<DataLanhRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const sale = (await client.query<{ id: string }>(`select ma_nguoi_dung as id from public.nguoi_dung where ma_nguoi_dung = $1 and vai_tro in ('sale-vn', 'sale-global', 'sale-global-lead')`, [saleId])).rows[0];
      if (!sale) throw new AppError(400, "VALIDATION_ERROR", "Chọn Sale care hợp lệ");
      const current = (await client.query<{ sale_care_id: string | null }>(
        `select sale_care_id from crm.data_lanh where id = $1::uuid and ($2::text is null or intern_id = $2 or sale_care_id = $2) for update`, [id, internId])).rows[0];
      if (!current) {
        await client.query("rollback");
        return null;
      }
      if (current.sale_care_id === saleId) throw new AppError(409, "CONFLICT", "Khách này đã được bàn giao cho Sale đó");
      await client.query(`update crm.data_lanh set sale_care_id = $2, ban_giao_luc = now(), ban_giao_boi = $3, cap_nhat_luc = now() where id = $1::uuid`, [id, saleId, actorId]);
      const row = (await client.query<Row>(`${select} where d.id = $1::uuid`, [id])).rows.map(toRecord)[0] ?? null;
      await client.query("commit");
      return row;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query(`delete from crm.data_lanh where id = $1::uuid`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /** internId = người đang thao tác (null = Admin/Ban GĐ): chỉ sửa được khách được giao hoặc bàn giao cho mình; dòng khác coi như không tồn tại. */
  async update(id: string, input: UpdateDataLanhInput, internId: string | null): Promise<DataLanhRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const current = (await client.query<Row>(`${select} where d.id = $1::uuid and ($2::text is null or d.intern_id = $2 or d.sale_care_id = $2) for update of d`, [id, internId])).rows[0];
      if (!current) {
        await client.query("rollback");
        return null;
      }
      const patch = { ...input };
      // A caller may have opened the transfer dialog before another user saved a call result.
      if (patch.facebookStatus === facebookStatuses[6] && hasActiveTelesale(current.telesale_status)) {
        patch.telesaleStatus = current.telesale_status;
      }
      const nextFacebook = patch.facebookStatus === undefined ? current.facebook_status : patch.facebookStatus;
      const nextTelesale = patch.telesaleStatus === undefined ? current.telesale_status : patch.telesaleStatus;
      if ((patch.facebookStatus !== undefined || patch.telesaleStatus !== undefined) && nextFacebook === facebookStatuses[6] && !hasActiveTelesale(nextTelesale)) {
        throw new AppError(422, "VALIDATION_ERROR", "Chọn kết quả gọi Telesale trước khi chuyển khách từ Facebook.");
      }
      if (nextFacebook === facebookStatuses[6] && hasActiveTelesale(nextTelesale)) {
        patch.facebookStatus = null;
      }
      // Tên cột lấy từ bảng cố định ở trên, giá trị luôn đi qua tham số; trường không gửi thì không đụng tới.
      const params: unknown[] = [id, internId];
      const sets = (Object.keys(editableColumns) as (keyof typeof editableColumns)[])
        .filter((key) => patch[key] !== undefined)
        .map((key) => {
          params.push(patch[key]?.trim() || null);
          return `${editableColumns[key]} = $${params.length}`;
        });
      await client.query(
        `update crm.data_lanh set ${[...sets, "cap_nhat_luc = now()"].join(", ")}
         where id = $1::uuid and ($2::text is null or intern_id = $2 or sale_care_id = $2)`,
        params,
      );
      const row = (await client.query<Row>(`${select} where d.id = $1::uuid`, [id])).rows.map(toRecord)[0] ?? null;
      await client.query("commit");
      return row;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Chia vòng tròn các dòng chưa giao cho danh sách người nhận (theo thu_tu), bắt đầu từ người kế sau người được giao gần nhất.
   * Dòng đã giao không bị đụng tới. Trả về số dòng đã chia.
   */
  async assignRoundRobin(): Promise<{ assigned: number; interns: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext('data_lanh_assign'))");
      const interns = (await client.query<{ id: string }>(`select nguoi_dung_id as id from crm.data_lanh_nguoi_nhan order by thu_tu`)).rows.map((r) => r.id);
      if (interns.length === 0) throw new AppError(409, "CONFLICT", "Chưa có danh sách người nhận data khách hàng");
      const last = (await client.query<{ id: string }>(`select intern_id as id from crm.data_lanh where giao_luc is not null and intern_id in (select nguoi_dung_id from crm.data_lanh_nguoi_nhan) order by giao_luc desc, stt desc limit 1`)).rows[0];
      const start = last ? (interns.indexOf(last.id) + 1) % interns.length : 0;
      const rows = (await client.query<{ id: string }>(`select id::text as id from crm.data_lanh where intern_id is null order by stt for update`)).rows;
      if (rows.length > 0) {
        await client.query(
          `update crm.data_lanh d set intern_id = t.intern_id, giao_luc = now(), cap_nhat_luc = now()
           from unnest($1::uuid[], $2::text[]) as t(id, intern_id) where d.id = t.id`,
          [rows.map((r) => r.id), rows.map((_, i) => interns[(start + i) % interns.length])],
        );
      }
      await client.query("commit");
      return { assigned: rows.length, interns: interns.length };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
