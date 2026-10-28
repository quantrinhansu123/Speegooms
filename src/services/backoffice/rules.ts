import { z } from "zod";
import type { Complaint, LegalTicket } from "../../types/backoffice.ts";
import type { Contract, Lead, Rfq } from "../../types/crm.ts";
import type { Role } from "../../types/role.ts";

const text = z.string().trim().min(1, "Vui lòng nhập nội dung").max(2000, "Tối đa 2.000 ký tự");
export const date = z.iso.date();
export const categories = ["Hư hỏng hàng", "Thiếu hàng", "Giao trễ", "Sai chứng từ", "Khác"] as const;
export const priorities = ["Thường", "Cao", "Khẩn cấp"] as const;
export const qualityOptions = ["Tốt", "Cần bổ sung", "Không phù hợp"] as const;
export const onboardingTasks = ["Hồ sơ lao động", "Thiết bị & tài khoản", "Đào tạo quy trình", "Người hướng dẫn"];
export const complaintSchema = z.object({
  orderId: text, title: text.max(160), description: text,
  category: z.enum(categories), priority: z.enum(priorities), assigneeId: text, dueOn: date,
  evidence: z.string().trim().max(2000),
});
export const feedbackSchema = z.object({ messId: text, quality: z.enum(qualityOptions), note: text });
export const employeeSchema = z.object({
  name: text.max(120), email: z.email(), department: z.enum(["marketing", "sale-vn", "sale-global", "van-hanh", "ke-toan", "hcns", "phap-che"]),
  position: text.max(120), managerId: z.string(), joinedOn: date,
  status: z.enum(["thu-viec", "chinh-thuc", "tam-nghi", "nghi-viec"]),
  contractType: text.max(120), contractEnd: z.union([date, z.literal("")]), documents: z.string().max(2000),
}).refine((x) => !x.contractEnd || x.contractEnd >= x.joinedOn, { message: "Ngày hết hạn phải sau ngày vào làm", path: ["contractEnd"] });
export const candidateSchema = z.object({
  name: text.max(120), email: z.email(), department: employeeSchema.shape.department,
  position: text.max(120), startOn: date,
});
export const legalSchema = z.object({
  title: text.max(160), refId: text, refType: z.enum(["hop-dong", "chung-tu"]),
  request: text, assigneeId: text, dueOn: date,
});
export const campaignSchema = z.object({
  name: text.max(160), source: z.enum(["ads", "google", "organic"]), startOn: date, endOn: date,
  budget: z.number().finite().nonnegative(), spent: z.number().finite().nonnegative(),
}).refine((x) => x.endOn >= x.startOn, { message: "Ngày kết thúc phải sau ngày bắt đầu", path: ["endOn"] });
export const compensationSchema = z.object({ amount: z.number().finite().positive().max(1e12), reason: text });
export const noteSchema = text;

export function canWrite(role: Role, module: "marketing" | "complaints" | "hrm" | "legal" | "feedback") {
  if (role === "admin") return true;
  const roles: Record<typeof module, Role[]> = {
    marketing: ["marketing"], complaints: ["van-hanh", "ban-gd"], hrm: ["hcns"], legal: ["phap-che"], feedback: ["sale-vn", "sale-global"],
  };
  return roles[module].includes(role);
}
export const canApprove = (role: Role) => role === "admin" || role === "ban-gd";
export const complaintTransitions: Record<Complaint["status"], Complaint["status"][]> = {
  moi: ["dang-xu-ly"], "dang-xu-ly": ["cho-khach", "hoan-tat"], "cho-khach": ["dang-xu-ly", "hoan-tat"], "hoan-tat": [],
};
export function complaintTransitionError(ticket: Complaint, next: Complaint["status"], result: string) {
  if (!complaintTransitions[ticket.status].includes(next)) return "Chuyển trạng thái không hợp lệ";
  if (next === "hoan-tat" && !result.trim()) return "Cần nhập kết quả trước khi hoàn tất";
  if (next === "hoan-tat" && ticket.compensation.status === "cho-duyet") return "Đề xuất đền bù đang chờ duyệt";
  return null;
}
export const legalTransitions: Record<LegalTicket["status"], LegalTicket["status"][]> = {
  moi: ["dang-ra-soat"], "dang-ra-soat": ["cho-duyet"], "cho-duyet": ["da-duyet", "tra-lai"], "tra-lai": ["dang-ra-soat"], "da-duyet": [],
};

// Đếm lead duy nhất trong cùng cohort; một lead có nhiều RFQ/đơn vẫn chỉ được đếm một lần.
export function sourceMetrics(leads: Pick<Lead, "messId" | "source" | "createdAt">[], rfqs: Pick<Rfq, "messId" | "status">[], contracts: Pick<Contract, "messId" | "status">[], from: string, to: string) {
  const cohort = leads.filter((l) => l.createdAt.slice(0, 10) >= from && l.createdAt.slice(0, 10) <= to);
  const rfqIds = new Set(rfqs.filter((r) => r.status !== "da-huy").map((r) => r.messId));
  const orderIds = new Set(contracts.filter((c) => c.status === "da-ky").map((c) => c.messId));
  return (["ads", "google", "organic"] as const).map((source) => {
    const ids = new Set(cohort.filter((l) => l.source === source).map((l) => l.messId));
    const rfq = [...ids].filter((id) => rfqIds.has(id)).length;
    const orders = [...ids].filter((id) => orderIds.has(id)).length;
    return { source, leads: ids.size, rfq, orders, rfqRate: ids.size ? rfq / ids.size * 100 : 0, orderRate: ids.size ? orders / ids.size * 100 : 0 };
  });
}
