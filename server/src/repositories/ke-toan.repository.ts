import type { CreateInternalExpenseInput, CreateLedgerEntryInput, CreatePaymentRequestInput, CreatePayrollInput, CreateStatementInput } from "@speego/shared";
import type { ExpenseListSearch, PaymentListSearch, PayrollListSearch } from "../search/ke-toan-list-search";

export interface PaymentRequestRecord {
  id: string;
  code: string;
  orderCode: string;
  customerName: string | null;
  payeeKind: string;
  purpose: string;
  payeeCode: string | null;
  payeeName: string | null;
  refCode: string | null;
  content: string;
  amount: number;
  currency: string;
  note: string | null;
  status: string;
  enteredBy: string | null;
  enteredAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  paidBy: string | null;
  paidAt: string | null;
}

/** Đơn hàng đã có xác nhận cọc của Kế toán, được phép lập đề nghị chi. */
export interface PaymentOrderOption {
  code: string;
  customerName: string;
  accountingStatus: string;
}

export interface PayrollRecord {
  id: string;
  code: string;
  period: string;
  employeeCode: string;
  fullName: string;
  department: string;
  position: string | null;
  baseSalary: number;
  allowance: number;
  insuranceDeduction: number;
  netPay: number;
}

export interface InternalExpenseRecord {
  id: string;
  code: string;
  spentOn: string;
  department: string;
  category: string;
  content: string;
  amount: number;
  status: string;
}

export interface LedgerRecord {
  id: string;
  date: string;
  kind: "THU" | "CHI";
  category: string;
  counterparty: string;
  orderCode: string | null;
  amount: number;
  reference: string | null;
  reconciled: boolean;
  statementId: string | null;
}

export interface StatementRecord {
  id: string;
  date: string;
  kind: "THU" | "CHI";
  amount: number;
  counterparty: string;
  description: string | null;
  orderCode: string | null;
  ledgerId: string | null;
}

export type CreatePaymentResult =
  | { result: "ok"; payment: PaymentRequestRecord }
  | { result: "order_missing" }
  | { result: "deposit_missing" };

export interface KeToanRepository {
  listLedger(): Promise<LedgerRecord[]>;
  listStatements(): Promise<StatementRecord[]>;
  listLedgerOrders(): Promise<{ code: string; customerName: string }[]>;
  createStatement(input: CreateStatementInput): Promise<StatementRecord>;
  createLedger(input: CreateLedgerEntryInput): Promise<LedgerRecord>;
  reconcileLedger(id: string, statementId: string): Promise<LedgerRecord>;
  listPaymentOrders(): Promise<PaymentOrderOption[]>;
  listPayments(search: PaymentListSearch): Promise<PaymentRequestRecord[]>;
  createPayment(input: CreatePaymentRequestInput, actor: string): Promise<CreatePaymentResult>;
  listPayroll(search: PayrollListSearch): Promise<PayrollRecord[]>;
  createPayroll(input: CreatePayrollInput): Promise<PayrollRecord>;
  listExpenses(search: ExpenseListSearch): Promise<InternalExpenseRecord[]>;
  createExpense(input: CreateInternalExpenseInput): Promise<InternalExpenseRecord>;
}
