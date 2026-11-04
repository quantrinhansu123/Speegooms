import { z } from "zod";

/** Khớp enum ke_toan.* trong migration 031. */
export const paymentPayeeKinds = ["NHA_CUNG_CAP", "DOI_TAC_VAN_CHUYEN"] as const;
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
  content: z.string().trim().min(1, "Nhập nội dung thanh toán").max(500),
  amount: money.positive("Số tiền phải lớn hơn 0"),
  currency: z.string().trim().length(3).toUpperCase().default("VND"),
  note: optionalText(1000),
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
