import { z } from "zod";
import type { Role } from "./user";

export const kpiDepartments = ["marketing", "sale-vn", "sale-global", "van-hanh", "ke-toan", "hcns", "phap-che"] as const;
export const kpiDepartmentSchema = z.enum(kpiDepartments);
export type KpiDepartment = z.infer<typeof kpiDepartmentSchema>;
export const kpiDepartmentLabels: Record<KpiDepartment, string> = {
  marketing: "P.MKT", "sale-vn": "Sale Việt Nam", "sale-global": "Sale Global",
  "van-hanh": "Vận hành", "ke-toan": "Kế toán", hcns: "HCNS", "phap-che": "Pháp chế",
};
export const kpiPeriodLabels = { month: "Tháng", quarter: "Quý", year: "Năm" } as const;

export function canManageKpis(role: Role): boolean {
  return role === "admin" || role === "ban-gd" || role === "marketing-lead";
}

export function manageableKpiDepartments(role: Role): readonly KpiDepartment[] {
  if (role === "admin" || role === "ban-gd") return kpiDepartments;
  return role === "marketing-lead" ? ["marketing"] : [];
}

const kpiFields = {
  department: kpiDepartmentSchema,
  group: z.string().trim().min(1, "Nhập bộ phận KPI").max(80, "Bộ phận tối đa 80 ký tự"),
  code: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,63}$/, "Mã KPI gồm 2–64 chữ cái, chữ số hoặc dấu gạch dưới; bắt đầu bằng chữ cái"),
  name: z.string().trim().min(1, "Nhập tên KPI").max(160, "Tên KPI tối đa 160 ký tự"),
  unit: z.string().trim().min(1, "Nhập đơn vị tính").max(40, "Đơn vị tối đa 40 ký tự"),
  target: z.number().finite().min(0, "Chỉ tiêu phải từ 0 trở lên").max(1e15, "Chỉ tiêu quá lớn").nullable(),
  period: z.enum(["month", "quarter", "year"]),
  active: z.boolean(),
};
export const createKpiSchema = z.object(kpiFields).strict();
export const updateKpiSchema = createKpiSchema.extend({ version: z.number().int().positive() });
export type CreateKpiInput = z.infer<typeof createKpiSchema>;
export type UpdateKpiInput = z.infer<typeof updateKpiSchema>;
export type KpiDefinition = CreateKpiInput & { id: string; version: number };
