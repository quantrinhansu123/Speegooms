import { z } from "zod";
import { salesReportMetricCodes, salesReportPeriods } from "./sales-report";
import type { Role } from "./user";

/** Mục tiêu giao theo từng người, theo tháng hoặc tuần. Dùng chung cho Sale và Marketing. */
export const targetDepartments = ["sale-vn", "sale-global", "marketing"] as const;
export type TargetDepartment = typeof targetDepartments[number];
export const targetDepartmentLabels: Record<TargetDepartment, string> = {
  "sale-vn": "Sale Việt Nam", "sale-global": "Sale Global", marketing: "Marketing",
};
export const targetPeriods = ["month", "week"] as const;
export type TargetPeriod = typeof targetPeriods[number];
export const targetPeriodLabels: Record<TargetPeriod, string> = { month: "Mục tiêu tháng được giao", week: "Mục tiêu tuần" };

export type TargetMetric = {
  code: string; name: string; unit: string; kind: "count" | "rate" | "money";
  /** Chỉ KPI Marketing: "at-most" là trần (chi phí/mess…), kết quả càng thấp càng tốt. */
  direction?: "at-least" | "at-most";
};

/** Chỉ tiêu Sale cố định; Marketing lấy từ danh mục KPI Marketing đang sử dụng. */
export const saleTargetMetrics: readonly TargetMetric[] = [
  { code: salesReportMetricCodes.selfSourced, name: "Khách hàng mới tự tìm", unit: "khách", kind: "count" },
  { code: salesReportMetricCodes.potentials, name: "Khách tiềm năng", unit: "khách", kind: "count" },
  { code: salesReportMetricCodes.quoteRate, name: "Tỷ lệ báo giá / Khách tiềm năng", unit: "%", kind: "rate" },
  { code: salesReportMetricCodes.closeRate, name: "Tỷ lệ chốt / Báo giá", unit: "%", kind: "rate" },
  { code: salesReportMetricCodes.revenue, name: "Doanh số (VNĐ)", unit: "VNĐ", kind: "money" },
];

/** Vai trò thuộc từng nhóm nhận mục tiêu. */
export const targetRoles: Record<TargetDepartment, readonly Role[]> = {
  "sale-vn": ["sale-vn"],
  "sale-global": ["sale-global", "sale-global-lead"],
  marketing: ["marketing", "marketing-lead", "marketing-content"],
};

export function manageableTargetDepartments(role: Role): readonly TargetDepartment[] {
  if (role === "admin" || role === "ban-gd") return targetDepartments;
  if (role === "sale-global-lead") return ["sale-global"];
  if (role === "marketing-lead") return ["marketing"];
  return [];
}

/** Ngày bắt đầu kỳ: tháng là mùng 1, tuần là Chủ nhật (khớp báo cáo Sale). */
export function isTargetPeriodStart(period: TargetPeriod, start: string): boolean {
  return salesReportPeriods(period, start).current.start === start;
}

const isoDay = z.iso.date().refine((date) => date >= "1900-02-01" && date <= "9998-12-31", "Ngày không hợp lệ");

export const targetQuerySchema = z.object({
  department: z.enum(targetDepartments),
  period: z.enum(targetPeriods),
  start: isoDay,
}).refine((value) => isTargetPeriodStart(value.period, value.start), { message: "Ngày bắt đầu kỳ không hợp lệ", path: ["start"] });
export type TargetQuery = z.infer<typeof targetQuerySchema>;

export const targetValueSchema = z.number().finite().min(0, "Mục tiêu phải từ 0 trở lên").max(1e15, "Mục tiêu quá lớn");

export const setTargetsSchema = z.object({
  department: z.enum(targetDepartments),
  period: z.enum(targetPeriods),
  start: isoDay,
  /** value null = xóa mục tiêu của người đó cho chỉ tiêu này. */
  rows: z.array(z.object({
    userId: z.string().trim().min(1).max(160),
    code: z.string().trim().min(1).max(64),
    value: targetValueSchema.nullable(),
  }).strict()).max(5000, "Tối đa 5.000 ô mỗi lần lưu"),
}).strict().refine((value) => isTargetPeriodStart(value.period, value.start), { message: "Ngày bắt đầu kỳ không hợp lệ", path: ["start"] });
export type SetTargetsInput = z.infer<typeof setTargetsSchema>;

export type TargetMember = { id: string; name: string };
export type TargetGrid = {
  members: TargetMember[];
  metrics: TargetMetric[];
  /** values[userId][code] = mục tiêu; không có khóa = chưa giao. */
  values: Record<string, Record<string, number>>;
};

/** Mục tiêu tháng → tuần: chia theo số ngày của tuần thuộc tháng đó (tuần có thể cắt qua hai tháng). */
export function weekShareOfMonth(weekStart: string, monthTargetFor: (monthStart: string) => number | undefined): number | undefined {
  let total = 0;
  let found = false;
  for (let index = 0; index < 7; index++) {
    const date = new Date(`${weekStart}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const value = monthTargetFor(month);
    if (value === undefined) continue;
    found = true;
    const days = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    total += value / days;
  }
  return found ? total : undefined;
}

export const targetTemplateSheets = { month: "Tháng", week: "Tuần" } as const;

/**
 * % hoàn thành so với mục tiêu. KPI tối thiểu: kết quả / mục tiêu. KPI tối đa (chi phí): mục tiêu / kết quả,
 * kết quả 0 thì đạt trọn (100%). Chưa có mục tiêu hoặc mục tiêu 0 thì trả null.
 */
export function targetCompletion(actual: number, target: number | undefined, direction: "at-least" | "at-most" = "at-least"): number | null {
  if (target === undefined || !(target > 0)) return null;
  if (direction === "at-most") return actual > 0 ? target / actual * 100 : 100;
  return actual / target * 100;
}
