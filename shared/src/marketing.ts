import { z } from "zod";
import type { Role } from "./user";

export const marketingTeamRoles = ["marketing", "marketing-content", "marketing-lead", "admin"];
export const isMarketingLeader = (role: Role) => role === "admin" || role === "marketing-lead";
export const canOrderMarketing = (role: Role) => isMarketingLeader(role) || role === "marketing-content";
export type MarketingMember = { id: string; name: string; email: string; role: Role };

export const marketingChannels = ["SpeeGo Logistics LLC", "SpeeGo Trung – Mỹ", "SpeeGo Express", "SpeeGo Business", "SpeeGo Trung – Úc", "SpeeGo Sourcing", "TikTok Anh Phúc", "TikTok Huy", "LinkedIn SpeeGo", "Khác"] as const;
export const mediaStatuses = ["Chưa bắt đầu", "Chờ quay", "Đang quay", "Đang dựng", "Chờ duyệt", "Cần chỉnh sửa", "Đã bàn giao", "Chưa đăng", "Đã đăng", "Hủy"] as const;
export const contentStatuses = ["Chưa bắt đầu", "Đang viết", "Chờ duyệt", "Cần chỉnh sửa", "Đã bàn giao", "Lên lịch", "Chưa đăng", "Đã đăng", "Hủy"] as const;
export const acceptanceOptions = ["Chưa nghiệm thu", "Đạt", "Cần chỉnh sửa", "Không đạt"] as const;
export const marketingKinds = ["media", "content", "ads", "seo"] as const;
export const marketingKindLabels = { media: "Media", content: "Content", ads: "Ads", seo: "SEO" };
export const adsStatuses = ["Chưa bắt đầu", "Đang thiết lập", "Đang chạy", "Đang tối ưu", "Tạm dừng", "Đã hoàn thành", "Hủy"] as const;
export const seoStatuses = ["Chưa bắt đầu", "Đang thực hiện", "Đang tối ưu", "Chờ duyệt", "Đã hoàn thành", "Hủy"] as const;
export const marketingStatuses = { media: mediaStatuses, content: contentStatuses, ads: adsStatuses, seo: seoStatuses };
export const marketingFormats = { media: ["Ảnh", "Video"], content: ["Bài ảnh", "Carousel", "Bài text", "Video/Reel", "Infographic", "Khác"], ads: ["Facebook Ads", "TikTok Ads", "Google Ads", "LinkedIn Ads", "Khác"], seo: ["SEO website", "SEO nội dung", "SEO kỹ thuật", "SEO AI", "Khác"] };
export const marketingKpiTypeSchema = z.object({
  id: z.string().uuid(), kind: z.enum(marketingKinds), name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(40), direction: z.enum(["at-least", "at-most"]),
  defaultTarget: z.number().finite().positive().max(1e15), active: z.boolean(),
});
export const marketingKpiSettingsSchema = z.object({
  version: z.number().int().nonnegative(), types: z.array(marketingKpiTypeSchema).max(100),
}).refine(s => new Set(s.types.map(t => t.id)).size === s.types.length, "Trùng loại KPI")
  .refine(s => new Set(s.types.map(t => `${t.kind}|${t.name.toLowerCase()}`)).size === s.types.length, "Tên KPI trong cùng nhóm không được trùng");
export type MarketingKpiType = z.infer<typeof marketingKpiTypeSchema>;
export type MarketingKpiSettings = z.infer<typeof marketingKpiSettingsSchema>;
export const marketingTaskKpiSchema = marketingKpiTypeSchema.omit({ kind: true, defaultTarget: true, active: true }).extend({
  target: z.number().finite().positive().max(1e15), actual: z.number().finite().nonnegative().max(1e15).nullable(),
});
export type MarketingTaskKpi = z.infer<typeof marketingTaskKpiSchema>;
export function marketingKpiMet(kpi: MarketingTaskKpi) {
  return kpi.actual !== null && (kpi.direction === "at-most" ? kpi.actual <= kpi.target : kpi.actual >= kpi.target);
}
const text = z.string().trim().max(4000);
const date = z.union([z.literal(""), z.iso.date()]);
const url = z.union([z.literal(""), z.url().refine(v => /^https?:\/\//i.test(v), "Link phải dùng http/https")]);
export const marketingTaskSchema = z.object({
  id: z.string().uuid(), version: z.number().int().nonnegative().default(0), kind: z.enum(marketingKinds),
  kpis: z.array(marketingTaskKpiSchema).max(30).default([]),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), channel: z.enum(marketingChannels), title: text.min(1), brief: text,
  format: text, size: text, pillar: text, assignee: text.min(1), collaborator: text,
  assigneeId: z.string().max(64).default(""), createdById: z.string().max(64).default(""), createdByName: text.default(""),
  assignedOn: z.iso.date(), deadline: z.iso.date(), completedOn: date,
  status: text, acceptance: z.enum(acceptanceOptions), assetUrl: url, postUrl: url, note: text,
}).superRefine((t, ctx) => {
  const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (!marketingFormats[t.kind].includes(t.format)) fail("format", "Định dạng không hợp lệ");
  if (!marketingStatuses[t.kind].some(s => s === t.status)) fail("status", "Trạng thái không hợp lệ");
  if (new Set(t.kpis.map(k => k.id)).size !== t.kpis.length) fail("kpis", "Trùng loại KPI trong công việc");
  if (t.deadline < t.assignedOn) fail("deadline", "Deadline không được trước ngày giao");
  if (t.completedOn && t.completedOn < t.assignedOn) fail("completedOn", "Ngày hoàn thành không được trước ngày giao");
  if (t.acceptance === "Đạt" && !t.completedOn) fail("completedOn", "Nghiệm thu Đạt cần ngày hoàn thành");
});
export type MarketingTask = z.infer<typeof marketingTaskSchema>;
export const marketingReportSchema = z.object({
  platform: z.enum(["facebook", "tiktok", "linkedin"]), channel: z.enum(marketingChannels), postId: text.min(1).max(250),
  postUrl: url.refine(Boolean, "Cần link bài đăng"), title: text, format: text, publishedOn: z.iso.date(), observedOn: z.iso.date(), observedFrom: date.optional(),
  views: z.number().finite().nonnegative().nullable(), interactions: z.number().finite().nonnegative().nullable(),
}).refine(r => r.observedOn >= r.publishedOn, "Ngày đo không được trước ngày đăng")
  .refine(r => !r.observedFrom || r.observedFrom <= r.observedOn, "Ngày đo từ ngày không được sau đến ngày")
  .refine(r => r.platform === "linkedin" ? r.channel === "LinkedIn SpeeGo" : r.platform === "tiktok" ? r.channel.startsWith("TikTok") : !r.channel.startsWith("TikTok") && r.channel !== "LinkedIn SpeeGo", "Kênh không khớp nền tảng báo cáo");
export type MarketingReport = z.infer<typeof marketingReportSchema>;
export function canonicalPostUrl(raw: string) {
  try { const u = new URL(raw); u.hash = ""; for (const k of [...u.searchParams.keys()]) if (!["story_fbid", "id", "v"].includes(k)) u.searchParams.delete(k); return u.toString().replace(/\/$/, ""); } catch { return raw.trim(); }
}
export function deadlineLabel(t: MarketingTask, today: string) {
  if (t.status === "Hủy") return "Đã hủy";
  if (!t.deadline) return "Thiếu deadline";
  if (t.completedOn) return t.completedOn <= t.deadline ? "Đúng hạn" : "Trễ hạn";
  return t.deadline < today ? "Quá hạn" : "Trong hạn";
}
export function taskKpi(tasks: MarketingTask[]) {
  const active = tasks.filter(t => t.status !== "Hủy");
  const done = active.filter(t => t.acceptance === "Đạt").length;
  return { assigned: active.length, done, rate: active.length ? done / active.length * 100 : null };
}
// Ngưỡng cố định từ Baseline Content Organic; không tính điều kiện 3 giây khi export chưa có dữ liệu.
const thresholds: Record<string, [number, number, number, number]> = {
  "SpeeGo Logistics LLC": [214, 2, 570, 1], "SpeeGo Trung – Mỹ": [254, 1, 243, 1], "SpeeGo Express": [197, 3, 126, 3],
  "SpeeGo Business": [118, 1, 195, 1], "SpeeGo Trung – Úc": [77, 1, 60, 1], "SpeeGo Sourcing": [254, 1, 610, 1],
  "LinkedIn SpeeGo": [104, 3, 127, 3], "TikTok Anh Phúc": [428, 15, 428, 15], "TikTok Huy": [705, 23, 705, 23],
};
export function contentEffect(r: MarketingReport) {
  const v = /video|reel/i.test(r.format); const image = /ảnh|image|photo/i.test(r.format);
  const t = thresholds[r.channel];
  if (!t || (!v && !image) || (r.platform === "tiktok" && !v)) return "Chưa có baseline";
  if (r.views === null || r.interactions === null) return "Thiếu số liệu";
  return r.views >= t[v ? 2 : 0] && r.interactions >= t[v ? 3 : 1] ? "Đạt hiệu quả" : "Chưa đạt";
}
