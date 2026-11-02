import type { CrmLane } from "@speego/shared";
import type pg from "pg";
import { AppError } from "../../lib/errors";
import type { PlannedMessage, PlannedPotential } from "../../services/crm-import-sheets";

const tables = {
  vn: {
    message: "crm.tin_nhan_viet_nam",
    potential: "crm.khach_hang_tiem_nang_viet_nam",
    sourcing: "crm.bao_gia_sourcing_viet_nam",
    logistics: "crm.bao_gia_logistics_viet_nam",
  },
  global: {
    message: "crm.tin_nhan_global",
    potential: "crm.khach_hang_tiem_nang_global",
    sourcing: "crm.bao_gia_sourcing_global",
    logistics: "crm.bao_gia_logistics_global",
  },
} as const;

export type StoredPotential = {
  id: string;
  kind: string | null;
  workflow: string;
};

export type StoredQuoteLink = {
  quoteId: string;
  desk: "sourcing" | "logistics";
};

export class PostgresCrmImportStore {
  constructor(private readonly pool: pg.Pool) {}

  async saveMessage(row: PlannedMessage): Promise<"created" | "updated"> {
    const table = tables[row.lane].message;
    const found = await this.query<{ id: string }>(
      `select id::text as id from ${table} where ma_tham_chieu_ngoai = $1 limit 1`,
      [row.externalRef],
    );
    const params = [
      row.customerName,
      row.phone || null,
      row.email || null,
      row.goods || null,
      row.demand ?? null,
      row.customerType ?? null,
      row.note || null,
      row.receivedOn ? `${row.receivedOn}T00:00:00+07:00` : null,
      row.market || null,
      row.classification ?? null,
      row.saleName || null,
      row.painPoint,
      row.linkMess || null,
      row.externalRef,
    ];
    if (found.rows[0]) {
      await this.query(
        `update ${table} set
           ten_khach_hang_tho = $1,
           so_dien_thoai = $2,
           thu_dien_tu = $3,
           hang_hoa = $4,
           nhu_cau = $5::text::crm.message_demand,
           loai_khach_hang = $6::text::crm.customer_type,
           ghi_chu = $7,
           nhan_luc = coalesce($8::timestamptz, nhan_luc),
           thi_truong = $9,
           phan_loai = $10::text::crm.message_classification,
           nhan_vien_ban = $11,
           ghi_chu_van_de = $12,
           link_mess = $13
         where id = $14::uuid`,
        [...params.slice(0, 13), found.rows[0].id],
      );
      return "updated";
    }
    await this.query(
      `insert into ${table} (
         ten_khach_hang_tho, so_dien_thoai, thu_dien_tu, hang_hoa, nhu_cau, loai_khach_hang, ghi_chu,
         nhan_luc, thi_truong, phan_loai, nhan_vien_ban, ghi_chu_van_de, link_mess, ma_tham_chieu_ngoai
       ) values (
         $1, $2, $3, $4, $5::text::crm.message_demand, $6::text::crm.customer_type, $7,
         coalesce($8::timestamptz, now()), $9, $10::text::crm.message_classification, $11, $12, $13, $14
       )`,
      params,
    );
    return "created";
  }

  async savePotential(row: PlannedPotential): Promise<"created" | "updated" | "no-mess" | "taken" | "no-contact"> {
    const table = tables[row.lane];
    return this.transaction(async (client) => {
      const message = await client.query<{ id: string; name: string | null; phone: string | null; email: string | null; source: string; goods: string | null }>(
        `select id::text as id, ten_khach_hang_tho as name, so_dien_thoai as phone, thu_dien_tu as email, nguon::text as source, hang_hoa as goods
         from ${table.message} where ma_tham_chieu_ngoai = $1 limit 1`,
        [row.messRef],
      );
      const mess = message.rows[0];
      if (!mess) return "no-mess";
      const phone = row.phone || mess.phone || "";
      const email = row.email || mess.email || "";
      if (!phone && !email) return "no-contact";
      const name = row.fullName || mess.name || `Khách ${row.externalRef}`;
      const kind = row.kind === "LOGISTICS" ? "LOGISTICS" : row.kind === "SOURCING" || row.kind === "BOTH" ? "SOURCING" : null;
      const workflow = row.kind === "SOURCING" ? "LEGACY" : "COMBINED";
      const existing = await client.query<{ id: string; external_ref: string | null; mess_id: string | null }>(
        `select id::text as id, ma_ngoai as external_ref, ma_tin_nhan::text as mess_id
         from ${table.potential}
         where xoa_luc is null and (ma_ngoai = $1 or ma_tin_nhan = $2::uuid)
         limit 1`,
        [row.externalRef, mess.id],
      );
      const current = existing.rows[0];
      if (current && ((current.external_ref && current.external_ref !== row.externalRef) || (current.mess_id && current.mess_id !== mess.id))) {
        return "taken";
      }
      const params = [
        name,
        row.companyName || null,
        phone,
        email,
        row.goods || mess.goods || null,
        row.quantityNote || null,
        row.address || null,
        row.saleNote || null,
        row.potential,
        kind,
        row.careChannel || null,
        row.packSpec || null,
        row.weightKg,
        row.shipFrom || null,
        row.shipTo || null,
        row.requirements || null,
        row.externalRef,
        workflow,
      ];
      if (current) {
        await client.query(
          `update ${table.potential} set
             ho_ten = $2,
             ten_cong_ty = coalesce($3, ten_cong_ty),
             so_dien_thoai = $4,
             thu_dien_tu = $5,
             san_pham_quan_tam = coalesce($6, san_pham_quan_tam),
             ghi_chu_so_luong = coalesce($7, ghi_chu_so_luong),
             dia_chi = coalesce($8, dia_chi),
             ghi_chu_ban_hang = coalesce($9, ghi_chu_ban_hang),
             tiem_nang = $10::crm.potential_status,
             nhom_khach = coalesce($11::text::crm.customer_kind, nhom_khach),
             kenh_cham_soc = coalesce($12, kenh_cham_soc),
             quy_cach_dong_goi = coalesce($13, quy_cach_dong_goi),
             trong_luong_kg = coalesce($14, trong_luong_kg),
             dia_chi_gui = coalesce($15, dia_chi_gui),
             dia_chi_nhan = coalesce($16, dia_chi_nhan),
             yeu_cau_khach = coalesce($17, yeu_cau_khach),
             ma_ngoai = $18,
             luong_bao_gia = case when $11::text = 'SOURCING' and $19 = 'LEGACY' then 'LEGACY' else luong_bao_gia end
           where id = $1::uuid`,
          [current.id, ...params],
        );
        return "updated";
      }
      await client.query(
        `insert into ${table.potential} (
           nguon, ho_ten, ten_cong_ty, so_dien_thoai, thu_dien_tu, san_pham_quan_tam, ghi_chu_so_luong, dia_chi,
           ghi_chu_ban_hang, tiem_nang, trang_thai, ma_tin_nhan, nhom_khach, kenh_cham_soc, quy_cach_dong_goi,
           trong_luong_kg, dia_chi_gui, dia_chi_nhan, yeu_cau_khach, ma_ngoai, luong_bao_gia
         ) values (
           $1::crm.lead_source, $2, $3, $4, $5, $6, $7, $8,
           $9, $10::crm.potential_status, 'NEW', $11::uuid, $12::text::crm.customer_kind, $13, $14,
           $15, $16, $17, $18, $19, $20
         )`,
        [
          mess.source,
          name,
          row.companyName || null,
          phone,
          email,
          row.goods || mess.goods || null,
          row.quantityNote || null,
          row.address || null,
          row.saleNote || null,
          row.potential,
          mess.id,
          kind,
          row.careChannel || null,
          row.packSpec || null,
          row.weightKg,
          row.shipFrom || null,
          row.shipTo || null,
          row.requirements || "Đã nhập từ Excel",
          row.externalRef,
          row.kind === "LOGISTICS" || row.kind === "BOTH" || row.kind == null ? "COMBINED" : "LEGACY",
        ],
      );
      await client.query(`update ${table.message} set trang_thai = 'CONVERTED' where id = $1::uuid and trang_thai <> 'CONVERTED'`, [mess.id]);
      return "created";
    });
  }

  async findPotential(lane: CrmLane, externalRef: string): Promise<StoredPotential | null> {
    const result = await this.query<{ id: string; kind: string | null; workflow: string }>(
      `select id::text as id, nhom_khach::text as kind, luong_bao_gia as workflow
       from ${tables[lane].potential}
       where ma_ngoai = $1 and xoa_luc is null
       limit 1`,
      [externalRef],
    );
    const row = result.rows[0];
    return row ? { id: row.id, kind: row.kind, workflow: row.workflow } : null;
  }

  async ensureKind(lane: CrmLane, id: string, kind: "SOURCING" | "LOGISTICS" | null, combined: boolean): Promise<StoredPotential | null> {
    const result = await this.query<{ id: string; kind: string | null; workflow: string }>(
      `update ${tables[lane].potential} set
         nhom_khach = coalesce(nhom_khach, $2::text::crm.customer_kind),
         luong_bao_gia = case
           when $3::boolean and coalesce(nhom_khach, $2::text::crm.customer_kind)::text = 'SOURCING' then 'COMBINED'
           when nhom_khach is null and $2::text = 'SOURCING' and not $3::boolean then 'LEGACY'
           else luong_bao_gia
         end
       where id = $1::uuid and xoa_luc is null
       returning id::text as id, nhom_khach::text as kind, luong_bao_gia as workflow`,
      [id, kind, combined],
    );
    const row = result.rows[0];
    return row ? { id: row.id, kind: row.kind, workflow: row.workflow } : null;
  }

  async replaceLogisticsOrders(lane: CrmLane, quoteId: string, sheet: unknown, orders: unknown, status: string): Promise<boolean> {
    const updated = await this.query(
      `update ${tables[lane].sourcing}
       set bao_gia_logistics = jsonb_set(
         jsonb_set(coalesce(bao_gia_logistics, $2::jsonb), '{orders}', $3::jsonb, true),
         '{quoteStatus}', to_jsonb($4::text), true
       )
       where id = $1::uuid
         and (bao_gia_logistics is null or bao_gia_logistics->>'sentQuote' is null)`,
      [quoteId, JSON.stringify(sheet), JSON.stringify(orders), status],
    );
    return (updated.rowCount ?? 0) > 0;
  }

  async findQuoteLink(lane: CrmLane, externalRef: string): Promise<StoredQuoteLink | null> {
    const table = tables[lane];
    const result = await this.query<{ sourcing_id: string | null; logistics_id: string | null; kind: string | null }>(
      `select s.id::text as sourcing_id, l.id::text as logistics_id, p.nhom_khach::text as kind
       from ${table.potential} p
       left join ${table.sourcing} s on s.ma_khach_hang_tiem_nang = p.id
       left join ${table.logistics} l on l.ma_khach_hang_tiem_nang = p.id
       where p.ma_ngoai = $1 and p.xoa_luc is null
       limit 1`,
      [externalRef],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.kind === "LOGISTICS" && row.logistics_id) return { quoteId: row.logistics_id, desk: "logistics" };
    if (row.sourcing_id) return { quoteId: row.sourcing_id, desk: "sourcing" };
    if (row.logistics_id) return { quoteId: row.logistics_id, desk: "logistics" };
    return null;
  }

  async contractState(lane: CrmLane, quoteId: string): Promise<{ id: string; paid: number; total: number; locked: boolean } | null> {
    const result = await this.query<{ id: string; paid: string; total: string; locked: boolean }>(
      `select h.id::text as id, h.so_tien_thanh_toan as paid, h.tong_gia_tri as total,
              exists (
                select 1 from crm.hop_dong_dong_thanh_toan d
                where d.ma_hop_dong = h.id and d.anh_bill <> '[]'::jsonb
              ) or exists (
                select 1 from crm.hop_dong_anh_bill b where b.ma_hop_dong = h.id
              ) as locked
       from crm.hop_dong h
       where h.tuyen = $1 and h.ma_bao_gia = $2::uuid
       limit 1`,
      [lane, quoteId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { id: row.id, paid: Number(row.paid), total: Number(row.total), locked: row.locked };
  }

  async updateContract(id: string, lane: CrmLane, input: {
    customerName: string;
    saleName: string;
    product: string;
    quantity: number | null;
    productValue: number;
    shippingCost: number;
    totalValue: number;
    paidAmount: number;
    signedOn: string;
    currency: string;
    tracking: string;
    replacePaid: boolean;
  }): Promise<void> {
    await this.query(
      `update crm.hop_dong set
         ten_khach_hang = $3,
         nhan_vien_ban = $4,
         san_pham = $5,
         so_luong = $6,
         gia_tri_san_pham = $7,
         chi_phi_van_chuyen = $8,
         tong_gia_tri = $9,
         so_tien_thanh_toan = case when $10::boolean then $11 else so_tien_thanh_toan end,
         ngay_ky = $12::date,
         loai_tien = $13,
         tracking = coalesce(nullif($14, ''), tracking)
       where id = $1::uuid and tuyen = $2`,
      [
        id,
        lane,
        input.customerName,
        input.saleName || null,
        input.product || null,
        input.quantity,
        input.productValue,
        input.shippingCost,
        input.totalValue,
        input.replacePaid,
        input.paidAmount,
        input.signedOn || null,
        input.currency,
        input.tracking,
      ],
    );
    if (!input.replacePaid) return;
    await this.query(`delete from crm.hop_dong_dong_thanh_toan where ma_hop_dong = $1::uuid`, [id]);
    if (input.paidAmount > 0) {
      await this.query(
        `insert into crm.hop_dong_dong_thanh_toan (ma_hop_dong, so_tien, thu_tu) values ($1::uuid, $2, 1)`,
        [id, input.paidAmount],
      );
    }
  }

  private async query<T extends pg.QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<pg.QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (cause) {
      throw dbError(cause);
    }
  }

  private async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (cause) {
      await client.query("rollback");
      throw dbError(cause);
    } finally {
      client.release();
    }
  }
}

function dbError(cause: unknown): Error {
  if (cause instanceof AppError) return cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = String((cause as { code: unknown }).code);
    const message = String((cause as { message?: unknown }).message ?? "").split("\n")[0] ?? "";
    if (code === "23505") return new AppError(409, "CONFLICT", "Dữ liệu bị trùng");
    if (code === "23514" || code === "42501") return new AppError(400, "RULE", message.slice(0, 200) || "Dữ liệu không hợp lệ");
    if (code === "22P02") return new AppError(400, "VALIDATION_ERROR", "Giá trị không hợp lệ");
  }
  return new AppError(500, "INTERNAL", "Không ghi được dữ liệu");
}
