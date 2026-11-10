import {
  builtinProposalTemplates,
  proposalDetailSchemas,
  proposalPeriodLabels,
  proposalPeriodRange,
  type BuiltinProposalId,
  type CreateProposalInput,
  type ProposalDecision,
  type ProposalGroup,
  type ProposalPeriod,
  type ProposalRecord,
  type ProposalStep,
  type ProposalTemplateRecord,
  type ProposalUser,
  type PublicUser,
  type SaveProposalTemplateInput,
} from "@speego/shared";
import type pg from "pg";
import { AppError } from "../../lib/errors";

type Row = {
  id: string; ma: string; mau_id: string; loai: ProposalRecord["kind"]; ten_mau: string; ve_viec: string; noi_dung: string;
  chi_tiet: Record<string, unknown>; dinh_kem: { name: string }[]; nguoi_theo_doi: { id: string; name: string }[];
  nguoi_tao_id: string; ten_nguoi_tao: string; trang_thai: ProposalRecord["status"]; buoc_hien_tai: number;
  cac_buoc: ProposalStep[]; tao_luc: Date;
};

type TemplateRow = {
  id: string; ma_goc: BuiltinProposalId | null; nhom: ProposalGroup; tieu_de: string; mo_ta: string; ve_viec: string;
  noi_dung: string; mau: string; nguoi_duyet: { id: string; name: string }[]; gioi_han: number | null;
  chu_ky: ProposalPeriod; ten_nguoi_tao: string | null;
};

const select = `
  select d.id::text as id, d.ma, d.mau_id, d.loai, d.ten_mau, d.ve_viec, d.noi_dung, d.chi_tiet, d.dinh_kem,
         d.nguoi_theo_doi, d.nguoi_tao_id, u.ho_ten as ten_nguoi_tao, d.trang_thai, d.buoc_hien_tai, d.cac_buoc, d.tao_luc
  from app.de_xuat d join public.nguoi_dung u on u.ma_nguoi_dung = d.nguoi_tao_id`;

const toRecord = (r: Row): ProposalRecord => ({
  id: r.id, code: r.ma, templateId: r.mau_id, kind: r.loai, templateTitle: r.ten_mau, subject: r.ve_viec, content: r.noi_dung,
  details: r.chi_tiet, attachments: r.dinh_kem, followers: r.nguoi_theo_doi, requesterId: r.nguoi_tao_id,
  requesterName: r.ten_nguoi_tao, status: r.trang_thai, currentStep: r.buoc_hien_tai, steps: r.cac_buoc,
  createdAt: r.tao_luc.toISOString(),
});

const toTemplate = (row: TemplateRow, base: (typeof builtinProposalTemplates)[number] | undefined): ProposalTemplateRecord => ({
  id: base?.id ?? row.id, recordId: row.id, baseId: base?.id ?? null, kind: base?.kind ?? "chung", group: row.nhom,
  title: row.tieu_de, description: row.mo_ta, subject: row.ve_viec, content: row.noi_dung, color: row.mau,
  approvers: row.nguoi_duyet, limit: row.gioi_han, period: row.chu_ky, createdByName: row.ten_nguoi_tao,
});

export class PostgresDeXuatRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** Người có thể được chọn làm người duyệt / theo dõi. */
  async users(): Promise<ProposalUser[]> {
    const r = await this.pool.query<ProposalUser>(
      `select ma_nguoi_dung as id, ho_ten as name, phong_ban as department, chuc_danh as title from public.nguoi_dung order by ho_ten`);
    return r.rows;
  }

  /** userId = chỉ đề xuất do người đó tạo / được giao duyệt / theo dõi; null = tất cả. */
  async list(userId: string | null): Promise<ProposalRecord[]> {
    const r = await this.pool.query<Row>(
      `${select}
       where $1::text is null or d.nguoi_tao_id = $1
          or d.cac_buoc @> $2::jsonb or d.nguoi_theo_doi @> $3::jsonb
       order by d.tao_luc desc limit 1000`,
      [userId, JSON.stringify([{ approverId: userId }]), JSON.stringify([{ id: userId }])],
    );
    return r.rows.map(toRecord);
  }

  async byId(id: string): Promise<ProposalRecord | null> {
    const r = await this.pool.query<Row>(`${select} where d.id = $1::uuid`, [id]);
    return r.rows[0] ? toRecord(r.rows[0]) : null;
  }

  /** Mẫu hệ thống (kèm bản ghi đè nếu có) + mẫu riêng; mẫu riêng mới nhất đứng đầu. */
  async templates(): Promise<ProposalTemplateRecord[]> {
    const rows = (await this.pool.query<TemplateRow>(
      `select t.id::text as id, t.ma_goc, t.nhom, t.tieu_de, t.mo_ta, t.ve_viec, t.noi_dung, t.mau, t.nguoi_duyet,
              t.gioi_han, t.chu_ky, u.ho_ten as ten_nguoi_tao
       from app.de_xuat_mau t left join public.nguoi_dung u on u.ma_nguoi_dung = t.nguoi_tao_id order by t.tao_luc desc`)).rows;
    const custom = rows.filter((r) => !r.ma_goc).map((r) => toTemplate(r, undefined));
    const builtin = builtinProposalTemplates.map((b): ProposalTemplateRecord => {
      const override = rows.find((r) => r.ma_goc === b.id);
      if (override) return toTemplate(override, b);
      return {
        id: b.id, recordId: null, baseId: b.id, kind: b.kind, group: b.group, title: b.title, description: b.description,
        subject: b.title, content: "", color: b.color, approvers: [], limit: b.limit, period: b.period, createdByName: null,
      };
    });
    return [...custom, ...builtin];
  }

  private async names(ids: readonly string[]): Promise<{ id: string; name: string }[]> {
    if (ids.length === 0) return [];
    const r = await this.pool.query<{ id: string; name: string }>(
      `select ma_nguoi_dung as id, ho_ten as name from public.nguoi_dung where ma_nguoi_dung = any($1::text[])`, [ids]);
    // Giữ đúng thứ tự người dùng chọn (thứ tự duyệt).
    const byId = new Map(r.rows.map((u) => [u.id, u]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) throw new AppError(422, "VALIDATION_ERROR", "Có người được chọn không tồn tại");
    return ids.map((id) => byId.get(id)!);
  }

  async create(actor: PublicUser, input: CreateProposalInput): Promise<ProposalRecord> {
    const template = (await this.templates()).find((t) => t.id === input.templateId);
    if (!template) throw new AppError(422, "VALIDATION_ERROR", "Mẫu đề xuất không tồn tại");
    const details = proposalDetailSchemas[template.kind].safeParse(input.details);
    if (!details.success) {
      throw new AppError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ",
        details.error.issues.map((i) => ({ path: `details.${i.path.join(".")}`.slice(0, 80), message: i.message.slice(0, 200) })));
    }
    if (new Set(input.approverIds).size !== input.approverIds.length) throw new AppError(422, "VALIDATION_ERROR", "Mỗi người chỉ được chọn duyệt một lần");
    if (input.approverIds.includes(actor.id)) throw new AppError(422, "VALIDATION_ERROR", "Không thể tự phê duyệt đề xuất của mình");
    const approvers = await this.names(input.approverIds);
    const followers = await this.names([...new Set(input.followerIds)]);

    if (template.limit) {
      const { start, end } = proposalPeriodRange(template.period, new Date());
      // ponytail: đếm rồi chèn không cùng giao dịch — hai đơn gửi cùng lúc có thể vượt hạn mức 1 lần; khóa theo người dùng nếu cần chặt hơn.
      const used = Number((await this.pool.query<{ n: string }>(
        `select count(*) as n from app.de_xuat where nguoi_tao_id = $1 and mau_id = $2 and trang_thai <> 'tu-choi' and tao_luc >= $3 and tao_luc < $4`,
        [actor.id, template.id, start, end])).rows[0]!.n);
      if (used >= template.limit) {
        throw new AppError(409, "CONFLICT", `Đã hết hạn mức ${template.limit} lần/${proposalPeriodLabels[template.period]} của mẫu này`);
      }
    }

    const steps: ProposalStep[] = approvers.map((a) => ({
      approverId: a.id, approverName: a.name, decision: null, decidedAt: null, decidedById: null, decidedByName: null, comment: "",
    }));
    const inserted = await this.pool.query<{ id: string }>(
      `insert into app.de_xuat (mau_id, loai, ten_mau, ve_viec, noi_dung, chi_tiet, dinh_kem, nguoi_theo_doi, nguoi_tao_id, cac_buoc)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10::jsonb) returning id::text as id`,
      [template.id, template.kind, template.title, input.subject, input.content, JSON.stringify(details.data),
        JSON.stringify(input.attachments), JSON.stringify(followers), actor.id, JSON.stringify(steps)],
    );
    return (await this.byId(inserted.rows[0]!.id))!;
  }

  /** Người duyệt của bước hiện tại hoặc Admin (duyệt thay). Khóa dòng để hai người không cùng duyệt một bước. */
  async decide(actor: PublicUser, id: string, decision: ProposalDecision, comment: string): Promise<ProposalRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const row = (await client.query<{ cac_buoc: ProposalStep[]; buoc_hien_tai: number; trang_thai: ProposalRecord["status"] }>(
        `select cac_buoc, buoc_hien_tai, trang_thai from app.de_xuat where id = $1::uuid for update`, [id])).rows[0];
      if (!row) {
        await client.query("rollback");
        return null;
      }
      if (row.trang_thai !== "cho-duyet") throw new AppError(409, "CONFLICT", "Đề xuất này đã được xử lý");
      const steps = row.cac_buoc;
      const step = steps[row.buoc_hien_tai];
      if (!step) throw new AppError(409, "CONFLICT", "Đề xuất không còn bước duyệt");
      if (step.approverId !== actor.id && actor.role !== "admin") throw new AppError(403, "FORBIDDEN", "Chưa đến lượt bạn duyệt đề xuất này");
      steps[row.buoc_hien_tai] = { ...step, decision, decidedAt: new Date().toISOString(), decidedById: actor.id, decidedByName: actor.name, comment };
      const last = row.buoc_hien_tai === steps.length - 1;
      const status = decision === "tu-choi" ? "tu-choi" : last ? "da-duyet" : "cho-duyet";
      await client.query(
        `update app.de_xuat set cac_buoc = $2::jsonb, buoc_hien_tai = $3, trang_thai = $4, cap_nhat_luc = now() where id = $1::uuid`,
        [id, JSON.stringify(steps), status === "cho-duyet" ? row.buoc_hien_tai + 1 : row.buoc_hien_tai, status],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return this.byId(id);
  }

  /** Chỉ xóa đề xuất đã xử lý xong; userId = chỉ xóa của chính mình, null = Admin. Trả về số dòng đã xóa. */
  async removeFinished(ids: readonly string[], userId: string | null): Promise<number> {
    const r = await this.pool.query(
      `delete from app.de_xuat where id = any($1::uuid[]) and trang_thai <> 'cho-duyet' and ($2::text is null or nguoi_tao_id = $2)`, [ids, userId]);
    return r.rowCount ?? 0;
  }

  /** recordId = sửa dòng có sẵn; bỏ trống + baseId = ghi đè mẫu hệ thống; bỏ trống cả hai = mẫu riêng mới. */
  async saveTemplate(actor: PublicUser, input: SaveProposalTemplateInput, recordId: string | null): Promise<ProposalTemplateRecord> {
    const approvers = await this.names(input.approverIds);
    const values = [input.group, input.title, input.description, input.subject || input.title, input.content, input.color,
      JSON.stringify(approvers), input.limit, input.period];
    let id: string | undefined;
    if (recordId) {
      id = (await this.pool.query<{ id: string }>(
        `update app.de_xuat_mau set nhom = $2, tieu_de = $3, mo_ta = $4, ve_viec = $5, noi_dung = $6, mau = $7, nguoi_duyet = $8::jsonb,
           gioi_han = $9, chu_ky = $10, cap_nhat_luc = now() where id = $1::uuid returning id::text as id`, [recordId, ...values])).rows[0]?.id;
      if (!id) throw new AppError(404, "NOT_FOUND", "Không tìm thấy mẫu");
    } else {
      id = (await this.pool.query<{ id: string }>(
        `insert into app.de_xuat_mau (ma_goc, nguoi_tao_id, nhom, tieu_de, mo_ta, ve_viec, noi_dung, mau, nguoi_duyet, gioi_han, chu_ky)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
         on conflict (ma_goc) where ma_goc is not null do update set nhom = excluded.nhom, tieu_de = excluded.tieu_de, mo_ta = excluded.mo_ta,
           ve_viec = excluded.ve_viec, noi_dung = excluded.noi_dung, mau = excluded.mau, nguoi_duyet = excluded.nguoi_duyet,
           gioi_han = excluded.gioi_han, chu_ky = excluded.chu_ky, cap_nhat_luc = now()
         returning id::text as id`, [input.baseId ?? null, actor.id, ...values])).rows[0]!.id;
    }
    return (await this.templates()).find((t) => t.recordId === id)!;
  }

  /** Xóa mẫu riêng, hoặc xóa bản ghi đè để mẫu hệ thống về mặc định. */
  async removeTemplate(recordId: string): Promise<boolean> {
    const r = await this.pool.query(`delete from app.de_xuat_mau where id = $1::uuid`, [recordId]);
    return (r.rowCount ?? 0) > 0;
  }
}
