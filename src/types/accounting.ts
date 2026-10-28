import type { Camelize } from "./crm";

/** DTO Kế toán (snake_case); model camelCase suy ra bằng Camelize. Xem types/crm.ts. */

export type PaymentKind = "nha-cung-cap" | "doi-tac-van-chuyen";
export type PaymentPurpose = "dat-coc-xuong" | "thanh-toan-xuong" | "cuoc-van-chuyen" | "khac";
/** Nhập → duyệt → chi tách nhau. "da-chi" chỉ là ghi nhận trạng thái, không phải chuyển tiền thật. */
export type PaymentStatus = "nhap" | "cho-duyet" | "da-duyet" | "da-chi" | "tu-choi" | "huy";
export type SettlementStatus = "chua-quyet-toan" | "dang-quyet-toan" | "da-quyet-toan";

/** Dòng sao kê ngân hàng demo, không kết nối ngân hàng thật. */
export interface StatementLineDto {
  line_id: string;
  date: string;
  kind: "thu" | "chi";
  amount: number;
  counterparty: string;
  description: string;
  matched_order_id?: string;
  matched_payment_id?: string;
}

export interface CustomerReceiptDto {
  receipt_id: string;
  order_id: string;
  date: string;
  amount: number;
  ref: string;
  recorded_by: string;
}

export interface PaymentLogDto {
  at: string;
  by: string;
  text: string;
}

export interface PaymentRequestDto {
  payment_id: string;
  kind: PaymentKind;
  /** supplier_id hoặc partner_id tuỳ kind */
  payee_id: string;
  order_id: string;
  /** po_id hoặc shipment_id */
  ref_id: string;
  purpose: PaymentPurpose;
  amount: number;
  status: PaymentStatus;
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  paid_by?: string;
  paid_at?: string;
  bank_ref?: string;
  reconciled_at?: string;
  reject_reason?: string;
  note?: string;
  log: PaymentLogDto[];
}

export interface SettlementDto {
  order_id: string;
  status: SettlementStatus;
  closed_at?: string;
  closed_by?: string;
  note?: string;
}

export interface AccountingSnapshotDto {
  statement_lines: StatementLineDto[];
  customer_receipts: CustomerReceiptDto[];
  payments: PaymentRequestDto[];
  settlements: SettlementDto[];
}

export type StatementLine = Camelize<StatementLineDto>;
export type CustomerReceipt = Camelize<CustomerReceiptDto>;
export type PaymentRequest = Camelize<PaymentRequestDto>;
export type PaymentLog = Camelize<PaymentLogDto>;
export type Settlement = Camelize<SettlementDto>;
export type AccountingSnapshot = Camelize<AccountingSnapshotDto>;
