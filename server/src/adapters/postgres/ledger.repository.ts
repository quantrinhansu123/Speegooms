import type pg from "pg";
import type { CreateLedgerEntryInput, CreateStatementInput } from "@speego/shared";
import { AppError, InfrastructureError } from "../../lib/errors";
import type { LedgerRecord, StatementRecord } from "../../repositories/ke-toan.repository";

const ledgerSelect = `select l.id::text, l.ngay::text as date, l.loai::text as kind,
  l.khoan_muc::text as category, l.doi_tuong as counterparty,
  l.ma_don_hang as order_code, l.so_tien::text as amount,
  l.ma_tham_chieu as reference, l.da_doi_soat as reconciled,
  l.ma_sao_ke::text as statement_id from ke_toan.so_thu_chi l`;
const statementSelect = `select s.id::text, s.ngay::text as date, s.loai::text as kind,
  s.so_tien::text as amount, s.doi_tuong as counterparty,
  s.noi_dung as description, s.ma_don_hang as order_code,
  l.id::text as ledger_id from ke_toan.sao_ke s
  left join ke_toan.so_thu_chi l on l.ma_sao_ke = s.id`;

type LedgerRow = {
  id: string; date: string; kind: "THU" | "CHI"; category: string;
  counterparty: string; order_code: string | null; amount: string;
  reference: string | null; reconciled: boolean; statement_id: string | null;
};
type StatementRow = {
  id: string; date: string; kind: "THU" | "CHI"; amount: string;
  counterparty: string; description: string | null; order_code: string | null; ledger_id: string | null;
};
const toLedger = (row: LedgerRow): LedgerRecord => ({
  id: row.id, date: row.date, kind: row.kind, category: row.category,
  counterparty: row.counterparty, orderCode: row.order_code, amount: Number(row.amount),
  reference: row.reference, reconciled: row.reconciled, statementId: row.statement_id,
});
const toStatement = (row: StatementRow): StatementRecord => ({
  id: row.id, date: row.date, kind: row.kind, amount: Number(row.amount),
  counterparty: row.counterparty, description: row.description,
  orderCode: row.order_code, ledgerId: row.ledger_id,
});

function databaseError(cause: unknown): never {
  if (cause instanceof AppError) throw cause;
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "23505") throw new AppError(409, "CONFLICT", "Dòng sao kê đã được dùng");
  if (code === "23503" || code === "23514" || code === "22P02") {
    throw new AppError(400, "VALIDATION_ERROR", "Dữ liệu thu chi không hợp lệ");
  }
  throw new InfrastructureError("ledger database query failed", { cause });
}

export class PostgresLedgerRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listLedger(): Promise<LedgerRecord[]> {
    try {
      const result = await this.pool.query<LedgerRow>(`${ledgerSelect} order by l.ngay desc, l.tao_luc desc`);
      return result.rows.map(toLedger);
    } catch (cause) { databaseError(cause); }
  }

  async listStatements(): Promise<StatementRecord[]> {
    try {
      const result = await this.pool.query<StatementRow>(`${statementSelect} order by s.ngay desc, s.tao_luc desc`);
      return result.rows.map(toStatement);
    } catch (cause) { databaseError(cause); }
  }

  async listLedgerOrders(): Promise<{ code: string; customerName: string }[]> {
    try {
      const result = await this.pool.query<{ code: string; customer_name: string }>(
        `select ma_hien_thi as code, ten_khach_hang as customer_name
         from crm.hop_dong order by tao_luc desc limit 500`,
      );
      return result.rows.map((row) => ({ code: row.code, customerName: row.customer_name }));
    } catch (cause) { databaseError(cause); }
  }

  async createStatement(input: CreateStatementInput): Promise<StatementRecord> {
    try {
      if (input.orderCode) {
        const order = await this.pool.query(`select 1 from crm.hop_dong where ma_hien_thi = $1`, [input.orderCode]);
        if (!order.rowCount) throw new AppError(404, "NOT_FOUND", "Không tìm thấy đơn hàng");
      }
      const inserted = await this.pool.query<{ id: string }>(
        `insert into ke_toan.sao_ke (ngay, loai, so_tien, doi_tuong, noi_dung, ma_don_hang)
         values ($1::date, $2::ke_toan.loai_thu_chi, $3, $4, $5, $6) returning id::text`,
        [input.date, input.kind, input.amount, input.counterparty, input.description || null, input.orderCode || null],
      );
      const result = await this.pool.query<StatementRow>(`${statementSelect} where s.id = $1::uuid`, [inserted.rows[0]?.id]);
      return toStatement(result.rows[0]);
    } catch (cause) { databaseError(cause); }
  }

  private async lockStatement(client: pg.PoolClient, id: string, kind: string, amount: number, orderCode: string | null) {
    const found = await client.query<{ kind: string; amount: string; order_code: string | null; payment_id: string | null }>(
      `select loai::text as kind, so_tien::text as amount, ma_don_hang as order_code,
        ma_de_nghi::text as payment_id from ke_toan.sao_ke where id = $1::uuid for update`,
      [id],
    );
    const row = found.rows[0];
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy dòng sao kê");
    if (row.kind !== kind || Number(row.amount) !== amount || (row.order_code && orderCode && row.order_code !== orderCode)) {
      throw new AppError(409, "RULE", "Sao kê không khớp loại, số tiền hoặc đơn hàng");
    }
    const used = await client.query(`select 1 from ke_toan.so_thu_chi where ma_sao_ke = $1::uuid`, [id]);
    if (used.rowCount) throw new AppError(409, "CONFLICT", "Dòng sao kê đã được đối soát");
    if (!row.order_code) {
      await client.query(`update ke_toan.sao_ke set ma_don_hang = $2 where id = $1::uuid`, [id, orderCode]);
    }
    return { paymentId: row.payment_id, orderCode: row.order_code };
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
      databaseError(cause);
    } finally { client.release(); }
  }

  async createLedger(input: CreateLedgerEntryInput): Promise<LedgerRecord> {
    return this.transaction(async (client) => {
      if (input.orderCode) {
        const order = await client.query(`select 1 from crm.hop_dong where ma_hien_thi = $1`, [input.orderCode]);
        if (!order.rowCount) throw new AppError(404, "NOT_FOUND", "Không tìm thấy đơn hàng");
      }
      const inserted = await client.query<{ id: string }>(
        `insert into ke_toan.so_thu_chi
          (ngay, loai, khoan_muc, doi_tuong, ma_don_hang, so_tien, ma_tham_chieu,
           da_doi_soat, ma_de_nghi, ma_sao_ke)
         values ($1::date, $2::ke_toan.loai_thu_chi, $3::ke_toan.khoan_muc_thu_chi,
           $4, $5, $6, $7, false, null, null) returning id::text`,
        [input.date, input.kind, input.category, input.counterparty, input.orderCode ?? null,
          input.amount, input.reference || null],
      );
      const created = await client.query<LedgerRow>(`${ledgerSelect} where l.id = $1::uuid`, [inserted.rows[0]?.id]);
      return toLedger(created.rows[0]);
    });
  }

  async reconcileLedger(id: string, statementId: string): Promise<LedgerRecord> {
    return this.transaction(async (client) => {
      const found = await client.query<{ kind: string; amount: string; order_code: string | null; reconciled: boolean }>(
        `select loai::text as kind, so_tien::text as amount, ma_don_hang as order_code,
          da_doi_soat as reconciled from ke_toan.so_thu_chi where id = $1::uuid for update`,
        [id],
      );
      const row = found.rows[0];
      if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy dòng thu chi");
      if (row.reconciled) throw new AppError(409, "CONFLICT", "Dòng này đã đối soát");
      const statement = await this.lockStatement(client, statementId, row.kind, Number(row.amount), row.order_code);
      await client.query(
        `update ke_toan.so_thu_chi
         set ma_sao_ke = $2::uuid, ma_de_nghi = coalesce(ma_de_nghi, $3::uuid),
             ma_don_hang = coalesce(ma_don_hang, $4),
             da_doi_soat = true, cap_nhat_luc = now()
         where id = $1::uuid`,
        [id, statementId, statement.paymentId, statement.orderCode],
      );
      const updated = await client.query<LedgerRow>(`${ledgerSelect} where l.id = $1::uuid`, [id]);
      return toLedger(updated.rows[0]);
    });
  }
}
