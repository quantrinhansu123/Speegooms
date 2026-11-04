import type { CreateInternalExpenseInput, CreatePaymentRequestInput, CreatePayrollInput } from "@speego/shared";
import type pg from "pg";
import { AppError, InfrastructureError } from "../../lib/errors";
import type {
  CreatePaymentResult,
  InternalExpenseRecord,
  KeToanRepository,
  PaymentOrderOption,
  PaymentEmployeeOption,
  PaymentRequestRecord,
  PayrollRecord,
} from "../../repositories/ke-toan.repository";
import {
  expenseSearch,
  paymentSearch,
  payrollSearch,
  type ExpenseListSearch,
  type PaymentListSearch,
  type PayrollListSearch,
} from "../../search/ke-toan-list-search";

/** Đơn hàng được lập đề nghị chi: Kế toán đã xác nhận cọc hoặc thanh toán. */
const DEPOSIT_CONFIRMED = ["DA_HOAN_THANH_COC", "DA_HOAN_THANH_THANH_TOAN"] as const;

const paymentSelect = `select d.id::text as id, d.ma_hien_thi as code, d.ma_don_hang as order_code,
  d.ten_khach_hang as customer_name, d.doi_tuong_nhan::text as payee_kind, d.muc_dich::text as purpose,
  d.ma_nguoi_nhan as payee_code, d.nguoi_nhan as payee_name, d.ma_tham_chieu as ref_code,
  d.ma_tham_chieu_chi_tiet as references,
  d.noi_dung_thanh_toan as content, d.so_tien::text as amount, d.tien_te as currency, d.ghi_chu as note,
  d.trang_thai::text as status, d.nguoi_nhap as entered_by, d.nhap_luc as entered_at,
  d.nguoi_duyet as approved_by, d.duyet_luc as approved_at, d.nguoi_chi as paid_by, d.chi_luc as paid_at
  from ke_toan.de_nghi_thanh_toan d`;

const payrollSelect = `select l.id::text as id, l.ma_hien_thi as code, l.ky::text as period,
  l.ma_nhan_su as employee_code, l.ho_ten as full_name, l.phong_ban as department, l.vi_tri as position,
  l.luong_co_ban::text as base_salary, l.phu_cap::text as allowance,
  l.khau_tru_bao_hiem::text as insurance_deduction, l.thuc_nhan::text as net_pay
  from ke_toan.luong_nhan_su l`;

const expenseSelect = `select c.id::text as id, c.ma_hien_thi as code, c.ngay_chi::text as spent_on,
  c.phong_ban as department, c.hang_muc as category, c.noi_dung as content, c.so_tien::text as amount,
  c.trang_thai::text as status
  from ke_toan.chi_phi_noi_bo c`;

type PaymentRow = {
  id: string;
  code: string;
  order_code: string;
  customer_name: string | null;
  payee_kind: string;
  purpose: string;
  payee_code: string | null;
  payee_name: string | null;
  ref_code: string | null;
  references: { source: string; code: string }[];
  content: string;
  amount: string;
  currency: string;
  note: string | null;
  status: string;
  entered_by: string | null;
  entered_at: Date | string;
  approved_by: string | null;
  approved_at: Date | string | null;
  paid_by: string | null;
  paid_at: Date | string | null;
};

type PayrollRow = {
  id: string;
  code: string;
  period: string;
  employee_code: string;
  full_name: string;
  department: string;
  position: string | null;
  base_salary: string;
  allowance: string;
  insurance_deduction: string;
  net_pay: string;
};

type ExpenseRow = {
  id: string;
  code: string;
  spent_on: string;
  department: string;
  category: string;
  content: string;
  amount: string;
  status: string;
};

function stamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function stampOrNull(value: Date | string | null): string | null {
  return value ? stamp(value) : null;
}

function money(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPayment(row: PaymentRow): PaymentRequestRecord {
  return {
    id: row.id,
    code: row.code,
    orderCode: row.order_code,
    customerName: row.customer_name,
    payeeKind: row.payee_kind,
    purpose: row.purpose,
    payeeCode: row.payee_code,
    payeeName: row.payee_name,
    refCode: row.ref_code,
    references: row.references,
    content: row.content,
    amount: money(row.amount),
    currency: row.currency.trim(),
    note: row.note,
    status: row.status,
    enteredBy: row.entered_by,
    enteredAt: stamp(row.entered_at),
    approvedBy: row.approved_by,
    approvedAt: stampOrNull(row.approved_at),
    paidBy: row.paid_by,
    paidAt: stampOrNull(row.paid_at),
  };
}

function toPayroll(row: PayrollRow): PayrollRecord {
  return {
    id: row.id,
    code: row.code,
    period: row.period.slice(0, 7),
    employeeCode: row.employee_code,
    fullName: row.full_name,
    department: row.department,
    position: row.position,
    baseSalary: money(row.base_salary),
    allowance: money(row.allowance),
    insuranceDeduction: money(row.insurance_deduction),
    netPay: money(row.net_pay),
  };
}

function toExpense(row: ExpenseRow): InternalExpenseRecord {
  return {
    id: row.id,
    code: row.code,
    spentOn: row.spent_on,
    department: row.department,
    category: row.category,
    content: row.content,
    amount: money(row.amount),
    status: row.status,
  };
}

function raise(cause: unknown): never {
  if (cause instanceof AppError) throw cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = String((cause as { code: unknown }).code);
    if (code === "23505") throw new AppError(409, "CONFLICT", "Dữ liệu bị trùng");
    if (code === "23514") throw new AppError(400, "RULE", "Dữ liệu không hợp lệ");
    if (code === "22P02" || code === "22003") throw new AppError(400, "VALIDATION_ERROR", "Giá trị không hợp lệ");
  }
  throw new InfrastructureError("database query failed", { cause });
}

export class PostgresKeToanRepository implements KeToanRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listPaymentOrders(): Promise<PaymentOrderOption[]> {
    const result = await this.query<{ code: string; customer_name: string; accounting_status: string }>(
      `select h.ma_hien_thi as code, h.ten_khach_hang as customer_name, h.trang_thai_ke_toan::text as accounting_status
         from crm.hop_dong h
        where h.trang_thai_ke_toan::text = any($1::text[])
        order by h.tao_luc desc
        limit 500`,
      [DEPOSIT_CONFIRMED],
    );
    return result.rows.map((row) => ({ code: row.code, customerName: row.customer_name, accountingStatus: row.accounting_status }));
  }

  async listPaymentEmployees(): Promise<PaymentEmployeeOption[]> {
    const result = await this.query<{ code: string; name: string }>(
      `select id as code, name from users order by name`,
    );
    return result.rows;
  }

  async listPayments(search: PaymentListSearch): Promise<PaymentRequestRecord[]> {
    const compiled = paymentSearch(search).build();
    const result = await this.query<PaymentRow>(
      `${paymentSelect} where true ${compiled.sql} order by d.nhap_luc desc, d.ma_hien_thi desc limit 200`,
      compiled.values,
    );
    return result.rows.map(toPayment);
  }

  async createPayment(input: CreatePaymentRequestInput, actor: string): Promise<CreatePaymentResult> {
    return this.transaction(async (client) => {
      const order = await client.query<{ customer_name: string; accounting_status: string | null }>(
        `select ten_khach_hang as customer_name, trang_thai_ke_toan::text as accounting_status
           from crm.hop_dong where ma_hien_thi = $1`,
        [input.orderCode],
      );
      const row = order.rows[0];
      if (!row) return { result: "order_missing" } as const;
      if (!row.accounting_status || !(DEPOSIT_CONFIRMED as readonly string[]).includes(row.accounting_status)) {
        return { result: "deposit_missing" } as const;
      }
      let payeeCode = input.payeeCode ?? null;
      let payeeName = input.payeeName;
      if (input.payeeKind === "NHAN_VIEN") {
        const employee = await client.query<{ name: string }>(`select name from users where id = $1`, [payeeCode]);
        if (!employee.rows[0]) return { result: "employee_missing" } as const;
        payeeName = employee.rows[0].name;
      } else {
        const generated = await client.query<{ code: string }>(
          `insert into ke_toan.danh_ba_nguoi_nhan (doi_tuong_nhan, ten)
           values ($1::ke_toan.doi_tuong_nhan, $2)
           on conflict (doi_tuong_nhan, (lower(btrim(ten)))) do update set ten = excluded.ten
           returning ma as code`,
          [input.payeeKind, payeeName],
        );
        payeeCode = generated.rows[0]?.code ?? null;
      }
      const references = input.references.length > 0
        ? input.references
        : input.refCode ? [{ source: "Khác", code: input.refCode }] : [];
      const inserted = await client.query<{ id: string }>(
        `insert into ke_toan.de_nghi_thanh_toan (
           ma_don_hang, ten_khach_hang, doi_tuong_nhan, muc_dich, ma_nguoi_nhan, nguoi_nhan,
           ma_tham_chieu, ma_tham_chieu_chi_tiet, noi_dung_thanh_toan, so_tien, tien_te, ghi_chu, nguoi_nhap
         )
         values ($1, $2, $3::ke_toan.doi_tuong_nhan, $4::ke_toan.muc_dich_thanh_toan, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
         returning id::text as id`,
        [
          input.orderCode,
          row.customer_name,
          input.payeeKind,
          input.purpose,
          payeeCode,
          payeeName,
          references[0]?.code ?? null,
          JSON.stringify(references),
          input.content,
          input.amount,
          input.currency,
          input.note ?? null,
          actor,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new InfrastructureError("insert returned no row");
      await client.query(
        `insert into ke_toan.lich_su_de_nghi (ma_de_nghi, noi_dung, nguoi_thuc_hien) values ($1::uuid, $2, $3)`,
        [id, "Nhập đề nghị thanh toán", actor],
      );
      const created = await client.query<PaymentRow>(`${paymentSelect} where d.id = $1::uuid`, [id]);
      const createdRow = created.rows[0];
      if (!createdRow) throw new InfrastructureError("created payment not found");
      return { result: "ok", payment: toPayment(createdRow) } as const;
    });
  }

  async listPayroll(search: PayrollListSearch): Promise<PayrollRecord[]> {
    const compiled = payrollSearch(search).build();
    const result = await this.query<PayrollRow>(
      `${payrollSelect} where true ${compiled.sql} order by l.ky desc, l.ho_ten asc limit 500`,
      compiled.values,
    );
    return result.rows.map(toPayroll);
  }

  async createPayroll(input: CreatePayrollInput): Promise<PayrollRecord> {
    const inserted = await this.query<{ id: string }>(
      `insert into ke_toan.luong_nhan_su (
         ky, ma_nhan_su, ho_ten, phong_ban, vi_tri, luong_co_ban, phu_cap, khau_tru_bao_hiem
       )
       values (($1::text || '-01')::date, $2, $3, $4, $5, $6, $7, $8)
       returning id::text as id`,
      [input.period, input.employeeCode, input.fullName, input.department, input.position ?? null, input.baseSalary, input.allowance, input.insuranceDeduction],
    );
    const result = await this.query<PayrollRow>(`${payrollSelect} where l.id = $1::uuid`, [inserted.rows[0]?.id]);
    const row = result.rows[0];
    if (!row) throw new InfrastructureError("created payroll not found");
    return toPayroll(row);
  }

  async listExpenses(search: ExpenseListSearch): Promise<InternalExpenseRecord[]> {
    const compiled = expenseSearch(search).build();
    const result = await this.query<ExpenseRow>(
      `${expenseSelect} where true ${compiled.sql} order by c.ngay_chi desc, c.ma_hien_thi desc limit 500`,
      compiled.values,
    );
    return result.rows.map(toExpense);
  }

  async createExpense(input: CreateInternalExpenseInput): Promise<InternalExpenseRecord> {
    const inserted = await this.query<{ id: string }>(
      `insert into ke_toan.chi_phi_noi_bo (ngay_chi, phong_ban, hang_muc, noi_dung, so_tien)
       values ($1::date, $2, $3, $4, $5)
       returning id::text as id`,
      [input.spentOn, input.department, input.category, input.content, input.amount],
    );
    const result = await this.query<ExpenseRow>(`${expenseSelect} where c.id = $1::uuid`, [inserted.rows[0]?.id]);
    const row = result.rows[0];
    if (!row) throw new InfrastructureError("created expense not found");
    return toExpense(row);
  }

  private async query<T extends pg.QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<pg.QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (cause) {
      raise(cause);
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
      raise(cause);
    } finally {
      client.release();
    }
  }
}
