import type { CreateDataLanhInput, DataLanhRecord, UpdateDataLanhInput } from "@speego/shared";
import type pg from "pg";
import { AppError } from "../../lib/errors";

type Row = {
  id: string; stt: number; full_name: string | null; company: string | null; phone: string | null;
  facebook_link: string | null; market: string | null; segment: string | null; customer_class: string | null;
  address: string | null; interest: string | null; history: string | null; note: string | null;
  intern_id: string | null; intern_name: string | null; facebook_status: string | null;
  telesale_status: string | null; assigned_at: Date | null;
};

const select = `
  select d.id::text as id, d.stt, d.ho_ten as full_name, d.ten_tiem as company, d.so_dien_thoai as phone,
         d.link_facebook as facebook_link, d.thi_truong as market, d.mang_kinh_doanh as segment,
         d.phan_loai_khach as customer_class, d.dia_chi as address, d.quan_tam as interest,
         d.lich_su_cskh as history, d.ghi_chu as note, d.intern_id, u.ho_ten as intern_name,
         d.trang_thai_facebook as facebook_status, d.trang_thai_telesale as telesale_status, d.giao_luc as assigned_at
  from crm.data_lanh d left join public.nguoi_dung u on u.ma_nguoi_dung = d.intern_id`;

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
});

export class PostgresDataLanhRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** internId = chỉ lấy dòng giao cho intern đó; null = tất cả. */
  async list(internId: string | null): Promise<DataLanhRecord[]> {
    const result = await this.pool.query<Row>(`${select} where ($1::text is null or d.intern_id = $1) order by d.stt limit 2000`, [internId]);
    return result.rows.map(toRecord);
  }

  /** Thêm khách mới (chưa giao intern). Từ chối nếu SĐT đã có trong danh sách. */
  async create(input: CreateDataLanhInput): Promise<DataLanhRecord> {
    const digits = input.phone?.replace(/\D/g, "") ?? "";
    if (digits) {
      const dup = (await this.pool.query<{ stt: number; name: string | null }>(
        `select stt, ho_ten as name from crm.data_lanh where regexp_replace(coalesce(so_dien_thoai, ''), '\\D', '', 'g') = $1 limit 1`,
        [digits],
      )).rows[0];
      if (dup) throw new AppError(409, "CONFLICT", `SĐT này đã có trong danh sách: STT ${dup.stt}${dup.name ? ` (${dup.name})` : ""}`);
    }
    const keys = (Object.keys(editableColumns) as (keyof typeof editableColumns)[]).filter((key) => key in input && key !== "facebookStatus" && key !== "telesaleStatus");
    const values = keys.map((key) => (input as Record<string, string | null | undefined>)[key]?.trim() || null);
    // ponytail: STT = max + 1; hai người thêm cùng lúc có thể đụng UNIQUE (stt) -> báo lỗi, bấm lại. Dùng sequence nếu thêm nhiều.
    const inserted = await this.pool.query<{ id: string }>(
      `insert into crm.data_lanh (stt${keys.map((key) => `, ${editableColumns[key]}`).join("")})
       select coalesce(max(stt), 0) + 1${values.map((_, i) => `, $${i + 1}`).join("")} from crm.data_lanh
       returning id::text as id`,
      values,
    );
    const id = inserted.rows[0]!.id;
    return (await this.pool.query<Row>(`${select} where d.id = $1::uuid`, [id])).rows.map(toRecord)[0]!;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query(`delete from crm.data_lanh where id = $1::uuid`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /** internId = giới hạn trong dòng của intern; dòng không thuộc intern đó coi như không tồn tại. */
  async update(id: string, input: UpdateDataLanhInput, internId: string | null): Promise<DataLanhRecord | null> {
    // Tên cột lấy từ bảng cố định ở trên, giá trị luôn đi qua tham số; trường không gửi thì không đụng tới.
    const params: unknown[] = [id, internId];
    const sets = (Object.keys(editableColumns) as (keyof typeof editableColumns)[])
      .filter((key) => input[key] !== undefined)
      .map((key) => {
        params.push(input[key]?.trim() || null);
        return `${editableColumns[key]} = $${params.length}`;
      });
    const updated = await this.pool.query(
      `update crm.data_lanh set ${[...sets, "cap_nhat_luc = now()"].join(", ")}
       where id = $1::uuid and ($2::text is null or intern_id = $2)`,
      params,
    );
    if (!updated.rowCount) return null;
    return (await this.pool.query<Row>(`${select} where d.id = $1::uuid`, [id])).rows.map(toRecord)[0] ?? null;
  }

  /**
   * Chia vòng tròn các dòng chưa giao cho intern (theo id), bắt đầu từ intern kế sau người được giao gần nhất.
   * Dòng đã giao không bị đụng tới. Trả về số dòng đã chia.
   */
  async assignRoundRobin(): Promise<{ assigned: number; interns: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext('data_lanh_assign'))");
      const interns = (await client.query<{ id: string }>(`select ma_nguoi_dung as id from public.nguoi_dung where vai_tro = 'sale-intern' order by ma_nguoi_dung`)).rows.map((r) => r.id);
      if (interns.length === 0) throw new AppError(409, "CONFLICT", "Chưa có tài khoản Sales Intern để chia");
      const last = (await client.query<{ id: string }>(`select intern_id as id from crm.data_lanh where giao_luc is not null and intern_id is not null order by giao_luc desc, stt desc limit 1`)).rows[0];
      const start = last ? (interns.indexOf(last.id) + 1) % interns.length : 0;
      const rows = (await client.query<{ id: string }>(`select id::text as id from crm.data_lanh where intern_id is null order by stt`)).rows;
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
