import { z } from "zod";
import { quoteCurrencySchema } from "./crm";

export const ledgerKinds = ["THU", "CHI"] as const;
export const ledgerCategories = ["COC_KHACH", "THU_KHACH", "CHI_XUONG", "CHI_VAN_CHUYEN", "CHI_KHAC"] as const;
export const ledgerCategoryLabels: Record<(typeof ledgerCategories)[number], string> = {
  COC_KHACH: "Cọc khách",
  THU_KHACH: "Thu thanh toán khách",
  CHI_XUONG: "Chi xưởng",
  CHI_VAN_CHUYEN: "Chi vận chuyển",
  CHI_KHAC: "Chi khác",
};
const ledgerMoney = z.number().finite().positive("Số tiền phải lớn hơn 0")
  .max(9_999_999_999_999)
  .refine((value) => Math.round(value * 100) / 100 === value, "Số tiền tối đa 2 chữ số thập phân");
const ledgerDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không đúng định dạng").refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Ngày không tồn tại");
const orderCode = z.string().trim().max(64).optional().transform((value) => value || undefined);

const ledgerCurrency = {
  currency: quoteCurrencySchema.default("VND"),
  exchangeRate: z.number().finite().positive("Tỷ giá phải lớn hơn 0").max(1_000_000).refine(value => Math.round(value * 1_000_000) / 1_000_000 === value, "Tỷ giá tối đa 6 chữ số thập phân").nullable().default(null),
};
function validateCurrency(value: { currency: string; exchangeRate: number | null; amount: number }, ctx: z.RefinementCtx) {
  if (value.currency !== "VND" && value.exchangeRate == null) {
    ctx.addIssue({ code: "custom", path: ["exchangeRate"], message: "Nhập tỷ giá quy đổi VND" });
  }
  if (value.currency === "VND" && value.exchangeRate != null && value.exchangeRate !== 1) {
    ctx.addIssue({ code: "custom", path: ["exchangeRate"], message: "Tỷ giá VND phải bằng 1" });
  }
  const converted = ledgerAmountVnd(value);
  if (converted <= 0 || converted > 9_999_999_999_999) {
    ctx.addIssue({ code: "custom", path: ["amount"], message: "Số tiền quy đổi VND phải lớn hơn 0 và không vượt 9.999.999.999.999" });
  }
}
export function ledgerAmountVnd(value: { currency: string; exchangeRate: number | null; amount: number }): number {
  if (value.currency === "VND") return value.amount;
  // Integer arithmetic matches Postgres numeric rounding, including 0.29 × 50 = 14.5.
  const product = BigInt(Math.round(value.amount * 100)) * BigInt(Math.round((value.exchangeRate ?? 0) * 1_000_000));
  return Number((product + BigInt(50_000_000)) / BigInt(100_000_000));
}
export function ledgerMatchesStatement(ledger: { kind: string; currency: string; amount: number; amountVnd: number; orderCode: string | null }, statement: { kind: string; currency: string; amount: number; orderCode: string | null }): boolean {
  return ledger.kind === statement.kind
    && !(ledger.orderCode && statement.orderCode && ledger.orderCode !== statement.orderCode)
    && (statement.currency === "VND" ? ledger.amountVnd === statement.amount : ledger.currency === statement.currency && ledger.amount === statement.amount);
}

export const createStatementSchema = z.object({
  date: ledgerDay,
  kind: z.enum(ledgerKinds),
  amount: ledgerMoney,
  ...ledgerCurrency,
  counterparty: z.string().trim().min(1, "Nhập đối tượng").max(200),
  description: z.string().trim().max(1000).optional(),
  orderCode,
}).superRefine(validateCurrency);
export type CreateStatementInput = z.infer<typeof createStatementSchema>;

export const createLedgerEntrySchema = z.object({
  date: ledgerDay,
  kind: z.enum(ledgerKinds),
  category: z.enum(ledgerCategories),
  counterparty: z.string().trim().min(1, "Nhập đối tượng").max(200),
  orderCode,
  amount: ledgerMoney,
  ...ledgerCurrency,
  reference: z.string().trim().max(120).optional(),
}).superRefine((value, ctx) => {
  validateCurrency(value, ctx);
  const income = value.kind === "THU";
  if (income !== (value.category === "COC_KHACH" || value.category === "THU_KHACH")) {
    ctx.addIssue({ code: "custom", path: ["category"], message: "Khoản mục không khớp loại thu/chi" });
  }
});
export type CreateLedgerEntryInput = z.infer<typeof createLedgerEntrySchema>;

export const reconcileLedgerEntrySchema = z.object({ statementId: z.string().uuid() });
export type ReconcileLedgerEntryInput = z.infer<typeof reconcileLedgerEntrySchema>;

/** Khớp enum ke_toan.* trong migration 031. */
export const paymentPayeeKinds = ["NHA_CUNG_CAP", "DOI_TAC_VAN_CHUYEN", "NHAN_VIEN"] as const;
export const paymentPurposes = ["DAT_COC_XUONG", "THANH_TOAN_XUONG", "CUOC_VAN_CHUYEN", "KHAC"] as const;
export const paymentStatuses = ["NHAP", "CHO_DUYET", "DA_DUYET", "DA_CHI", "TU_CHOI", "HUY"] as const;
export const expenseStatuses = ["CHO_DUYET", "DA_CHI"] as const;

export const paymentPayeeKindSchema = z.enum(paymentPayeeKinds);
export const paymentPurposeSchema = z.enum(paymentPurposes);
export const paymentStatusSchema = z.enum(paymentStatuses);
export const expenseStatusSchema = z.enum(expenseStatuses);

export const paymentPayeeKindLabels: Record<(typeof paymentPayeeKinds)[number], string> = {
  NHA_CUNG_CAP: "Nhà cung cấp",
  DOI_TAC_VAN_CHUYEN: "Đối tác vận chuyển",
  NHAN_VIEN: "Nhân viên công ty",
};

export const paymentPurposeLabels: Record<(typeof paymentPurposes)[number], string> = {
  DAT_COC_XUONG: "Cọc xưởng",
  THANH_TOAN_XUONG: "Thanh toán xưởng",
  CUOC_VAN_CHUYEN: "Cước vận chuyển",
  KHAC: "Khác",
};

export const paymentStatusLabels: Record<(typeof paymentStatuses)[number], string> = {
  NHAP: "Nháp",
  CHO_DUYET: "Chờ duyệt",
  DA_DUYET: "Đã duyệt, chờ chi",
  DA_CHI: "Đã chi (ghi nhận)",
  TU_CHOI: "Bị từ chối",
  HUY: "Đã hủy",
};

export const expenseStatusLabels: Record<(typeof expenseStatuses)[number], string> = {
  CHO_DUYET: "Chờ duyệt",
  DA_CHI: "Đã chi",
};

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

const money = z.number({ message: "Nhập số tiền" }).finite().max(9_999_999_999_999);
const day = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không đúng định dạng");

/** Nhập đề nghị thanh toán (bước 1/3). Nội dung thanh toán là bắt buộc. */
export const createPaymentRequestSchema = z.object({
  orderCode: z.string().trim().min(1, "Chọn đơn hàng").max(64),
  payeeKind: paymentPayeeKindSchema,
  purpose: paymentPurposeSchema,
  payeeName: z.string().trim().min(1, "Nhập người nhận").max(200),
  payeeCode: optionalText(64),
  refCode: optionalText(64),
  references: z.array(z.object({
    source: z.string().trim().min(1, "Nhập nguồn tham chiếu").max(100),
    code: z.string().trim().min(1, "Nhập mã tham chiếu").max(100),
  })).max(20, "Tối đa 20 mã tham chiếu").default([]),
  content: z.string().trim().min(1, "Nhập nội dung thanh toán").max(500),
  amount: money.positive("Số tiền phải lớn hơn 0"),
  currency: z.string().trim().length(3).toUpperCase().default("VND"),
  note: optionalText(1000),
}).superRefine((value, ctx) => {
  if (value.payeeKind === "NHAN_VIEN" && !value.payeeCode) {
    ctx.addIssue({ code: "custom", message: "Chọn nhân viên công ty", path: ["payeeCode"] });
  }
});

export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestSchema>;

/** Một dòng lương của một nhân sự trong một kỳ (kỳ dạng YYYY-MM). */
export const createPayrollSchema = z.object({
  period: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ lương dạng YYYY-MM"),
  employeeCode: z.string().trim().min(1, "Nhập mã nhân sự").max(64),
  fullName: z.string().trim().min(1, "Nhập họ tên").max(200),
  department: z.string().trim().min(1, "Chọn phòng ban").max(120),
  position: optionalText(120),
  baseSalary: money.min(0, "Không được âm"),
  allowance: money.min(0, "Không được âm").default(0),
  insuranceDeduction: money.min(0, "Không được âm").default(0),
}).superRefine((value, ctx) => {
  if (value.insuranceDeduction > value.baseSalary + value.allowance) {
    ctx.addIssue({ code: "custom", message: "Khấu trừ bảo hiểm không được vượt lương cơ bản cộng phụ cấp", path: ["insuranceDeduction"] });
  }
});

export type CreatePayrollInput = z.infer<typeof createPayrollSchema>;

/** Chi phí nội bộ theo phòng ban, không gồm thanh toán nhà cung cấp. */
export const createInternalExpenseSchema = z.object({
  spentOn: day,
  department: z.string().trim().min(1, "Chọn phòng ban").max(120),
  category: z.string().trim().min(1, "Nhập hạng mục").max(120),
  content: z.string().trim().min(1, "Nhập nội dung").max(500),
  amount: money.positive("Số tiền phải lớn hơn 0"),
});

export type CreateInternalExpenseInput = z.infer<typeof createInternalExpenseSchema>;

/** Thực nhận = lương cơ bản + phụ cấp − khấu trừ bảo hiểm (khớp cột sinh sẵn trong DB). */
export function payrollNet(input: { baseSalary: number; allowance: number; insuranceDeduction: number }): number {
  return Math.round((input.baseSalary + input.allowance - input.insuranceDeduction) * 100) / 100;
}
