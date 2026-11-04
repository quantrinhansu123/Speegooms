import type { CreateInternalExpenseInput, CreatePaymentRequestInput, CreatePayrollInput } from "@speego/shared";
import { AppError } from "../lib/errors";
import type {
  InternalExpenseRecord,
  KeToanRepository,
  PaymentOrderOption,
  PaymentRequestRecord,
  PayrollRecord,
} from "../repositories/ke-toan.repository";
import type { ExpenseListSearch, PaymentListSearch, PayrollListSearch } from "../search/ke-toan-list-search";

/** Kế toán: đề nghị thanh toán, bảng lương, chi phí nội bộ. Quyền kiểm ở route. */
export class KeToanService {
  constructor(private readonly repo: KeToanRepository | null) {}

  listPaymentOrders(): Promise<PaymentOrderOption[]> {
    return this.repository().listPaymentOrders();
  }

  listPayments(search: PaymentListSearch): Promise<PaymentRequestRecord[]> {
    return this.repository().listPayments(search);
  }

  async createPayment(input: CreatePaymentRequestInput, actorName: string): Promise<PaymentRequestRecord> {
    const created = await this.repository().createPayment(input, actorName);
    if (created.result === "order_missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy đơn hàng");
    if (created.result === "deposit_missing") {
      throw new AppError(409, "RULE", "Đơn chưa có xác nhận Đã cọc của Kế toán, chưa thể lập đề nghị chi");
    }
    return created.payment;
  }

  listPayroll(search: PayrollListSearch): Promise<PayrollRecord[]> {
    return this.repository().listPayroll(search);
  }

  createPayroll(input: CreatePayrollInput): Promise<PayrollRecord> {
    return this.repository().createPayroll(input);
  }

  listExpenses(search: ExpenseListSearch): Promise<InternalExpenseRecord[]> {
    return this.repository().listExpenses(search);
  }

  createExpense(input: CreateInternalExpenseInput): Promise<InternalExpenseRecord> {
    return this.repository().createExpense(input);
  }

  private repository(): KeToanRepository {
    if (!this.repo) throw new AppError(503, "UNAVAILABLE", "Kế toán cần kết nối Postgres");
    return this.repo;
  }
}
