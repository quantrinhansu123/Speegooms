import { ledgerMatchesStatement } from "@speego/shared";
import type pg from "pg";
import type { LedgerReportGroup, LedgerReportRow, ListPage, PageRequest } from "@speego/shared";
import { queryPage } from "../../lib/pagination";
import { ledgerDateColumn, ledgerSearch, type LedgerListSearch } from "../../search/ke-toan-list-search";
import type { CreateLedgerEntryInput, CreateStatementInput } from "@speego/shared";
import { AppError, InfrastructureError } from "../../lib/errors";
import type { LedgerOrderOption, LedgerRecord, StatementRecord } from "../../repositories/ke-toan.repository";

const ledgerColumns = `select l.id::text, l.ngay::text as date, l.loai::text as kind,
  l.khoan_muc::text as category, l.doi_tuong as counterparty,
  l.ma_don_hang as order_code, l.so_tien::text as amount,
  l.tai_khoan_nhan as receiving_account, l.ngay_giao_dich::text as transaction_date,
  l.ma_tham_chieu as reference, l.da_doi_soat as reconciled,
  l.ma_sao_ke::text as statement_id, l.tien_te as currency, l.ty_gia::text as exchange_rate,
  l.so_tien_vnd::text as amount_vnd, h.ten_khach_hang as customer_name,
  l.phong_ban as department, l.hang_muc_noi_bo as item, l.noi_dung_noi_bo as content`;
const ledgerFrom = `from ke_toan.so_thu_chi l left join crm.hop_dong h on h.ma_hien_thi = l.ma_don_hang`;
const ledgerSelect = `${ledgerColumns} ${ledgerFrom}`;
const ledgerCustomerJoin = `
  left join crm.bao_gia_sourcing_viet_nam sv on h.tuyen = 'vn' and sv.id = h.ma_bao_gia
  left join crm.bao_gia_logistics_viet_nam lv on h.tuyen = 'vn' and lv.id = h.ma_bao_gia
  left join crm.bao_gia_sourcing_global sg on h.tuyen = 'global' and sg.id = h.ma_bao_gia
  left join crm.bao_gia_logistics_global lg on h.tuyen = 'global' and lg.id = h.ma_bao_gia
  cross join lateral (select case when h.id is null then 'unassigned' else coalesce(
    h.tuyen || ':lead:' || coalesce(sv.ma_khach_hang_tiem_nang, lv.ma_khach_hang_tiem_nang,
      sg.ma_khach_hang_tiem_nang, lg.ma_khach_hang_tiem_nang)::text,
    h.tuyen || ':name:' || lower(btrim(h.ten_khach_hang))) end as key) customer`;
const statementSelect = `select s.id::text, s.ngay::text as date, s.loai::text as kind,
  s.so_tien::text as amount, s.doi_tuong as counterparty,
  s.noi_dung as description, s.ma_don_hang as order_code,
  l.id::text as ledger_id, s.tien_te as currency, s.ty_gia::text as exchange_rate,
  s.so_tien_vnd::text as amount_vnd, h.ten_khach_hang as customer_name from ke_toan.sao_ke s
  left join crm.hop_dong h on h.ma_hien_thi = s.ma_don_hang
  left join ke_toan.so_thu_chi l on l.ma_sao_ke = s.id`;

type CurrencyRow = { currency: string; exchange_rate: string; amount_vnd: string; customer_name: string | null };

type LedgerRow = CurrencyRow & {
  id: string; date: string; kind: "THU" | "CHI"; category: string;
  counterparty: string; order_code: string | null; amount: string;
  receiving_account: string | null; transaction_date: string | null;
  reference: string | null; reconciled: boolean; statement_id: string | null;
  department: string | null; item: string | null; content: string | null;
};
type StatementRow = CurrencyRow & {
  id: string; date: string; kind: "THU" | "CHI"; amount: string;
  counterparty: string; description: string | null; order_code: string | null; ledger_id: string | null;
};
const toLedger = (row: LedgerRow): LedgerRecord => ({
  id: row.id, date: row.date, kind: row.kind, category: row.category,
  counterparty: row.counterparty, orderCode: row.order_code, amount: Number(row.amount),
  currency: row.currency, exchangeRate: Number(row.exchange_rate), amountVnd: Number(row.amount_vnd), customerName: row.customer_name,
  receivingAccount: row.receiving_account, transactionDate: row.transaction_date,
  department: row.department, item: row.item, content: row.content,
  reference: row.reference, reconciled: row.reconciled, statementId: row.statement_id,
});
const toStatement = (row: StatementRow): StatementRecord => ({
  id: row.id, date: row.date, kind: row.kind, amount: Number(row.amount),
  counterparty: row.counterparty, description: row.description,
  currency: row.currency, exchangeRate: Number(row.exchange_rate), amountVnd: Number(row.amount_vnd), customerName: row.customer_name,
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

  async pageLedger(search: LedgerListSearch, page: PageRequest): Promise<ListPage<LedgerRecord>> {
    const compiled = ledgerSearch(search).build();
    const source = `${ledgerSelect} ${search.customerKey ? ledgerCustomerJoin : ""} where true ${compiled.sql}`;
    const result = await queryPage<LedgerRow>(this.pool, source, compiled.values, page, {
      orderBy: "date desc, id desc",
      summary: `jsonb_build_object('thu', coalesce(sum(amount_vnd::numeric) filter (where kind = 'THU'), 0),
        'chi', coalesce(sum(amount_vnd::numeric) filter (where kind = 'CHI'), 0),
        'incomeByCurrency', (select coalesce(jsonb_object_agg(currency, amount), '{}'::jsonb) from (
          select currency, sum(amount::numeric) as amount from records where kind = 'THU' group by currency
        ) c))`,
    });
    return { ...result, rows: result.rows.map(toLedger) };
  }

  async pageLedgerReport(search: LedgerListSearch, group: LedgerReportGroup, page: PageRequest): Promise<ListPage<LedgerReportRow>> {
    const compiled = ledgerSearch(search).build();
    const byMonth = group !== "customer";
    const byCustomer = group !== "month";
    const month = byMonth ? `to_char(${ledgerDateColumn(search.dateField)}, 'YYYY-MM')` : "null::text";
    const customerKey = byCustomer ? "customer.key" : "null::text";
    const withCustomer = byCustomer || Boolean(search.customerKey);
    return queryPage<LedgerReportRow>(this.pool, `
      select jsonb_build_array(month, customer_key)::text as id, month, customer_key as "customerKey",
        max(customer_name) as "customerName", sum(income)::text as income, sum(expense)::text as expense,
        (sum(income) - sum(expense))::text as balance, count(*)::int as "entryCount"
      from (
        select ${month} as month, ${customerKey} as customer_key,
          ${byCustomer ? "h.ten_khach_hang" : "null::text"} as customer_name,
          case when l.loai = 'THU' then l.so_tien_vnd else 0 end as income,
          case when l.loai = 'CHI' then l.so_tien_vnd else 0 end as expense
        ${ledgerFrom} ${withCustomer ? ledgerCustomerJoin : ""} where true ${compiled.sql}
      ) entries group by month, customer_key`, compiled.values, page, {
      orderBy: 'month desc nulls last, "customerName" asc nulls last, id',
    });
  }

  async pageStatements(page: PageRequest, candidateFor?: string): Promise<ListPage<StatementRecord>> {
    const result = await queryPage<StatementRow>(this.pool, `${statementSelect} ${candidateFor ? `where l.id is null and exists (
        select 1 from ke_toan.so_thu_chi target where target.id = $1::uuid and target.loai = s.loai
          and (target.phong_ban is null or (s.ma_don_hang is null and s.ma_de_nghi is null))
          and (target.ma_don_hang is null or s.ma_don_hang is null or target.ma_don_hang = s.ma_don_hang)
          and (case when s.tien_te = 'VND' then target.so_tien_vnd = s.so_tien
            else target.tien_te = s.tien_te and target.so_tien = s.so_tien end)
      )` : ""}`, candidateFor ? [candidateFor] : [], page, {
      orderBy: "date desc, id desc", summary: "jsonb_build_object('unmatchedCount', count(*) filter (where ledger_id is null))",
    });
    return { ...result, rows: result.rows.map(toStatement) };
  }

  async listReceivingAccounts(): Promise<string[]> {
    try {
      const result = await this.pool.query<{ name: string }>(`select ten as name from ke_toan.tai_khoan_nhan order by ten`);
      return result.rows.map(row => row.name);
    } catch (cause) { databaseError(cause); }
  }

  async listLedgerCounterparties(): Promise<string[]> {
    try {
      const result = await this.pool.query<{ name: string }>(`select distinct doi_tuong as name from ke_toan.so_thu_chi where doi_tuong <> '' order by 1`);
      return result.rows.map(row => row.name);
    } catch (cause) { databaseError(cause); }
  }

  async createReceivingAccount(name: string): Promise<string> {
    try {
      await this.pool.query(`insert into ke_toan.tai_khoan_nhan (ten) values ($1) on conflict (ten) do nothing`, [name]);
      return name;
    } catch (cause) { databaseError(cause); }
  }

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

  async pageLedgerOrders(query: string, page: PageRequest): Promise<ListPage<LedgerOrderOption>> {
    const text = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d");
    const fold = (column: "ma_hien_thi" | "ten_khach_hang") =>
      `lower(translate(regexp_replace(normalize(${column}, NFD) collate "C", U&'[\\0300-\\036F]', '', 'g'), 'đĐ', 'dD'))`;
    return queryPage<LedgerOrderOption>(this.pool,
      `select id::text, ma_hien_thi as code, ten_khach_hang as "customerName", tao_luc,
        ${text ? `${fold("ma_hien_thi")} = $1` : "false"} as exact_code
       from crm.hop_dong ${text ? `where strpos(${fold("ma_hien_thi")}, $1) > 0 or strpos(${fold("ten_khach_hang")}, $1) > 0` : ""}`,
      text ? [text] : [], page,
      { orderBy: "exact_code desc, tao_luc desc, id desc" });
  }

  async createStatement(input: CreateStatementInput): Promise<StatementRecord> {
    try {
      if (input.orderCode) {
        const order = await this.pool.query(`select 1 from crm.hop_dong where ma_hien_thi = $1`, [input.orderCode]);
        if (!order.rowCount) throw new AppError(404, "NOT_FOUND", "Không tìm thấy đơn hàng");
      }
      const inserted = await this.pool.query<{ id: string }>(
        `insert into ke_toan.sao_ke (ngay, loai, so_tien, doi_tuong, noi_dung, ma_don_hang, tien_te, ty_gia)
         values ($1::date, $2::ke_toan.loai_thu_chi, $3, $4, $5, $6, $7, $8) returning id::text`,
        [input.date, input.kind, input.amount, input.counterparty, input.description || null, input.orderCode || null, input.currency, input.currency === "VND" ? 1 : input.exchangeRate],
      );
      const result = await this.pool.query<StatementRow>(`${statementSelect} where s.id = $1::uuid`, [inserted.rows[0]?.id]);
      return toStatement(result.rows[0]);
    } catch (cause) { databaseError(cause); }
  }

  private async lockStatement(client: pg.PoolClient, id: string, ledger: LedgerRecord) {
    const found = await client.query<{ kind: string; amount: string; currency: string; order_code: string | null; payment_id: string | null }>(
      `select loai::text as kind, so_tien::text as amount, tien_te as currency, ma_don_hang as order_code,
        ma_de_nghi::text as payment_id from ke_toan.sao_ke where id = $1::uuid for update`,
      [id],
    );
    const row = found.rows[0];
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy dòng sao kê");
    if (ledger.department && (row.order_code || row.payment_id)) {
      throw new AppError(409, "RULE", "Khoản nội bộ chỉ đối soát với sao kê chưa gắn hợp đồng hoặc đề nghị thanh toán");
    }
    if (!ledgerMatchesStatement(ledger, { kind: row.kind, currency: row.currency, amount: Number(row.amount), orderCode: row.order_code })) {
      throw new AppError(409, "RULE", "Sao kê không khớp loại, loại tiền, số tiền hoặc đơn hàng");
    }
    const used = await client.query(`select 1 from ke_toan.so_thu_chi where ma_sao_ke = $1::uuid`, [id]);
    if (used.rowCount) throw new AppError(409, "CONFLICT", "Dòng sao kê đã được đối soát");
    if (!row.order_code) {
      await client.query(`update ke_toan.sao_ke set ma_don_hang = $2 where id = $1::uuid`, [id, ledger.orderCode]);
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
           da_doi_soat, ma_de_nghi, ma_sao_ke, tien_te, ty_gia, tai_khoan_nhan, ngay_giao_dich,
           phong_ban, hang_muc_noi_bo, noi_dung_noi_bo)
         values ($1::date, $2::ke_toan.loai_thu_chi, $3::ke_toan.khoan_muc_thu_chi,
           $4, $5, $6, $7, false, null, null, $8, $9, $10, $11::date, $12, $13, $14) returning id::text`,
        [input.date, input.kind, input.category, input.counterparty, input.orderCode ?? null,
          input.amount, input.reference || null, input.currency, input.currency === "VND" ? 1 : input.exchangeRate,
          input.receivingAccount ?? null, input.transactionDate ?? null, input.department ?? null, input.item ?? null, input.content ?? null],
      );
      const created = await client.query<LedgerRow>(`${ledgerSelect} where l.id = $1::uuid`, [inserted.rows[0]?.id]);
      return toLedger(created.rows[0]);
    });
  }

  /** Khóa dòng thu chi để sửa/xóa; dòng đã đối soát thì không được đổi. */
  private async lockEditable(client: pg.PoolClient, id: string): Promise<void> {
    const found = await client.query<{ reconciled: boolean }>(
      `select da_doi_soat as reconciled from ke_toan.so_thu_chi where id = $1::uuid for update`, [id],
    );
    if (!found.rows[0]) throw new AppError(404, "NOT_FOUND", "Không tìm thấy dòng thu chi");
    if (found.rows[0].reconciled) throw new AppError(409, "CONFLICT", "Dòng đã đối soát, không thể sửa hoặc xóa");
  }

  async updateLedger(id: string, input: CreateLedgerEntryInput): Promise<LedgerRecord> {
    return this.transaction(async (client) => {
      await this.lockEditable(client, id);
      if (input.orderCode) {
        const order = await client.query(`select 1 from crm.hop_dong where ma_hien_thi = $1`, [input.orderCode]);
        if (!order.rowCount) throw new AppError(404, "NOT_FOUND", "Không tìm thấy đơn hàng");
      }
      await client.query(
        `update ke_toan.so_thu_chi
         set ngay = $2::date, loai = $3::ke_toan.loai_thu_chi, khoan_muc = $4::ke_toan.khoan_muc_thu_chi,
             doi_tuong = $5, ma_don_hang = $6, so_tien = $7, ma_tham_chieu = $8, tien_te = $9, ty_gia = $10,
             tai_khoan_nhan = case when $13::boolean then $11 else tai_khoan_nhan end,
             ngay_giao_dich = case when $14::boolean then $12::date else ngay_giao_dich end,
             phong_ban = $15, hang_muc_noi_bo = $16, noi_dung_noi_bo = $17, cap_nhat_luc = now()
         where id = $1::uuid`,
        [id, input.date, input.kind, input.category, input.counterparty, input.orderCode ?? null,
          input.amount, input.reference || null, input.currency, input.currency === "VND" ? 1 : input.exchangeRate,
          input.receivingAccount ?? null, input.transactionDate ?? null,
          input.receivingAccount !== undefined, input.transactionDate !== undefined,
          input.department ?? null, input.item ?? null, input.content ?? null],
      );
      const updated = await client.query<LedgerRow>(`${ledgerSelect} where l.id = $1::uuid`, [id]);
      return toLedger(updated.rows[0]);
    });
  }

  async deleteLedger(id: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockEditable(client, id);
      await client.query(`delete from ke_toan.so_thu_chi where id = $1::uuid`, [id]);
    });
  }

  async reconcileLedger(id: string, statementId: string): Promise<LedgerRecord> {
    return this.transaction(async (client) => {
      const found = await client.query<LedgerRow>(
        `${ledgerSelect} where l.id = $1::uuid for update of l`, [id],
      );
      const row = found.rows[0];
      if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy dòng thu chi");
      if (row.reconciled) throw new AppError(409, "CONFLICT", "Dòng này đã đối soát");
      const statement = await this.lockStatement(client, statementId, toLedger(row));
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
