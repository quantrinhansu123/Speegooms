import { z } from "zod";

/** Module Đề xuất: đề xuất chấm công, đi muộn/về sớm, thanh toán, nghỉ phép... đi qua tối đa 4 bước duyệt. */

export const proposalKinds = ["cham-cong", "di-muon-ve-som", "thanh-toan", "nghi-phep", "chung"] as const;
export type ProposalKind = (typeof proposalKinds)[number];

export const proposalGroups = ["CHẤM CÔNG", "THANH TOÁN", "VẮNG MẶT", "CHUNG"] as const;
export type ProposalGroup = (typeof proposalGroups)[number];

export const proposalPeriods = ["week", "month", "year"] as const;
export type ProposalPeriod = (typeof proposalPeriods)[number];
export const proposalPeriodLabels: Record<ProposalPeriod, string> = { week: "tuần", month: "tháng", year: "năm" };

export const MAX_PROPOSAL_STEPS = 4;

export type ProposalStatus = "cho-duyet" | "da-duyet" | "tu-choi";
export type ProposalDecision = "da-duyet" | "tu-choi";

/** Mẫu hệ thống. Admin / HCNS có thể ghi đè nội dung mặc định, người duyệt và hạn mức (lưu ở bảng de_xuat_mau theo `baseId`). */
export const builtinProposalTemplates = [
  { id: "cham-cong", kind: "cham-cong", group: "CHẤM CÔNG", title: "Đề xuất chấm công", description: "Bổ sung hoặc điều chỉnh công khi quên chấm công / chấm sai.", color: "#2563eb", limit: null, period: "month" },
  { id: "di-muon-ve-som", kind: "di-muon-ve-som", group: "CHẤM CÔNG", title: "Đi muộn/về sớm", description: "Xin phép đi muộn hoặc về sớm trong ngày làm việc.", color: "#8b5cf6", limit: null, period: "month" },
  { id: "thanh-toan", kind: "thanh-toan", group: "THANH TOÁN", title: "Đề xuất thanh toán", description: "Đề xuất chi / thanh toán một khoản cho cá nhân hoặc nhà cung cấp.", color: "#f59e0b", limit: null, period: "month" },
  { id: "nghi-phep", kind: "nghi-phep", group: "VẮNG MẶT", title: "Đơn xin nghỉ phép", description: "Gửi đơn xin nghỉ phép theo quy định của công ty.", color: "#22c55e", limit: 12, period: "year" },
  { id: "chung", kind: "chung", group: "CHUNG", title: "ĐỀ XUẤT", description: "Dùng khi cần trình đề xuất, xin ý kiến hoặc phê duyệt nội dung công việc.", color: "#16a34a", limit: null, period: "month" },
] as const satisfies readonly {
  id: string; kind: ProposalKind; group: ProposalGroup; title: string; description: string; color: string; limit: number | null; period: ProposalPeriod;
}[];
export type BuiltinProposalId = (typeof builtinProposalTemplates)[number]["id"];
const builtinIds = builtinProposalTemplates.map((t) => t.id) as [BuiltinProposalId, ...BuiltinProposalId[]];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ")
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d, "Ngày không hợp lệ");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ không hợp lệ");

/** Trường riêng của từng loại đề xuất (lưu ở `details`). */
export const proposalDetailSchemas = {
  "cham-cong": z
    .object({ date: isoDate, checkIn: hhmm.optional(), checkOut: hhmm.optional() })
    .refine((v) => v.checkIn || v.checkOut, { message: "Nhập giờ vào hoặc giờ ra cần bổ sung", path: ["checkIn"] }),
  "di-muon-ve-som": z.object({ date: isoDate, type: z.enum(["di-muon", "ve-som"]), time: hhmm }),
  "thanh-toan": z.object({
    amount: z.number("Số tiền không hợp lệ").int("Số tiền phải là số nguyên").positive("Số tiền phải lớn hơn 0").max(1e12, "Số tiền quá lớn"),
    payee: z.string().trim().min(1, "Nhập người / đơn vị thụ hưởng").max(200),
    bankAccount: z.string().trim().max(200).optional(),
  }),
  "nghi-phep": z
    .object({ startDate: isoDate, endDate: isoDate, leaveType: z.enum(["phep-nam", "khong-luong"]), duration: z.enum(["full", "half"]) })
    .refine((v) => v.endDate >= v.startDate, { message: "Ngày kết thúc phải sau ngày bắt đầu", path: ["endDate"] }),
  chung: z.object({}),
} as const satisfies Record<ProposalKind, z.ZodType>;

/** Số ngày nghỉ của đơn (tính cả ngày cuối, nửa ngày = 0,5). */
export function leaveDayCount(startDate: string, endDate: string, duration: "full" | "half"): number {
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
  return Math.max(0, days) * (duration === "half" ? 0.5 : 1);
}

/** [start, end) của tuần (thứ Hai đầu tuần) / tháng / năm chứa `at`. ponytail: theo múi giờ máy chạy, lệch tối đa vài giờ giữa FE và BE. */
export function proposalPeriodRange(period: ProposalPeriod, at: Date): { start: Date; end: Date } {
  const y = at.getFullYear(), m = at.getMonth(), d = at.getDate();
  if (period === "year") return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  if (period === "month") return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  const monday = d - ((at.getDay() + 6) % 7);
  return { start: new Date(y, m, monday), end: new Date(y, m, monday + 7) };
}

export const createProposalSchema = z.object({
  templateId: z.string().min(1).max(64),
  subject: z.string().trim().min(1, "Vui lòng nhập về việc").max(300, "Về việc tối đa 300 ký tự"),
  content: z.string().trim().min(1, "Vui lòng nhập nội dung").max(10_000, "Nội dung tối đa 10.000 ký tự"),
  details: z.record(z.string(), z.unknown()).default({}),
  /** Chỉ lưu tên tệp để hiển thị — chưa có kho lưu tệp. */
  attachments: z.array(z.object({ name: z.string().trim().min(1).max(255) })).max(20).default([]),
  followerIds: z.array(z.string().min(1).max(64)).max(20).default([]),
  approverIds: z.array(z.string().min(1).max(64)).min(1, "Vui lòng chọn ít nhất 1 người phê duyệt").max(MAX_PROPOSAL_STEPS, `Tối đa ${MAX_PROPOSAL_STEPS} người phê duyệt`),
});
export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const decideProposalSchema = z.object({
  decision: z.enum(["da-duyet", "tu-choi"]),
  comment: z.string().trim().max(1000, "Lý do tối đa 1000 ký tự").default(""),
});

export const deleteProposalsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

export const saveProposalTemplateSchema = z.object({
  /** Ghi đè mẫu hệ thống; bỏ trống = mẫu riêng. */
  baseId: z.enum(builtinIds).nullable().optional(),
  group: z.enum(proposalGroups),
  title: z.string().trim().min(1, "Vui lòng nhập tên mẫu").max(150),
  description: z.string().trim().max(300).default(""),
  subject: z.string().trim().max(300).default(""),
  content: z.string().trim().max(10_000).default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Màu không hợp lệ").default("#16a34a"),
  approverIds: z.array(z.string().min(1).max(64)).max(MAX_PROPOSAL_STEPS).default([]),
  limit: z.number().int().min(1, "Số lần tối đa phải lớn hơn 0").max(1000).nullable().default(null),
  period: z.enum(proposalPeriods).default("month"),
});
export type SaveProposalTemplateInput = z.infer<typeof saveProposalTemplateSchema>;

export interface ProposalStep {
  approverId: string;
  approverName: string;
  decision: ProposalDecision | null;
  decidedAt: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  comment: string;
}

export interface ProposalRecord {
  id: string;
  code: string;
  templateId: string;
  kind: ProposalKind;
  templateTitle: string;
  subject: string;
  content: string;
  details: Record<string, unknown>;
  attachments: { name: string }[];
  followers: { id: string; name: string }[];
  requesterId: string;
  requesterName: string;
  status: ProposalStatus;
  currentStep: number;
  steps: ProposalStep[];
  createdAt: string;
}

export interface ProposalTemplateRecord {
  /** Khóa mẫu hệ thống hoặc uuid mẫu riêng — dùng làm `templateId` khi tạo đề xuất. */
  id: string;
  /** uuid dòng trong DB (mẫu riêng hoặc bản ghi đè); null = mẫu hệ thống nguyên bản. */
  recordId: string | null;
  baseId: BuiltinProposalId | null;
  kind: ProposalKind;
  group: ProposalGroup;
  title: string;
  description: string;
  subject: string;
  content: string;
  color: string;
  approvers: { id: string; name: string }[];
  limit: number | null;
  period: ProposalPeriod;
  createdByName: string | null;
}

export interface ProposalUser {
  id: string;
  name: string;
  department: string;
  title: string;
}
