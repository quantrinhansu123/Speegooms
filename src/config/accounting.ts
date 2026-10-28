import { actionPermissions } from "./permissions.ts";
import type { Role } from "@/types/role";
import type { StatusTone } from "@/types/status";
import type { PaymentKind, PaymentPurpose, PaymentStatus, SettlementStatus } from "@/types/accounting";

export const paymentKindLabels: Record<PaymentKind, string> = { "nha-cung-cap": "Nhà cung cấp", "doi-tac-van-chuyen": "Đối tác vận chuyển" };

export const paymentPurposeLabels: Record<PaymentPurpose, string> = {
  "dat-coc-xuong": "Cọc xưởng",
  "thanh-toan-xuong": "Thanh toán xưởng",
  "cuoc-van-chuyen": "Cước vận chuyển",
  khac: "Khác",
};

export const paymentStatusMeta: Record<PaymentStatus, { label: string; tone: StatusTone }> = {
  nhap: { label: "Nháp", tone: "neutral" },
  "cho-duyet": { label: "Chờ duyệt", tone: "warning" },
  "da-duyet": { label: "Đã duyệt, chờ chi", tone: "info" },
  "da-chi": { label: "Đã chi (ghi nhận)", tone: "success" },
  "tu-choi": { label: "Bị từ chối", tone: "danger" },
  huy: { label: "Đã hủy", tone: "neutral" },
};

/** Ba bước tách nhau của một đề nghị chi: nhập → duyệt → chi. */
export const paymentSteps = [
  { key: "enter", label: "Nhập", doneBy: "Vận hành" },
  { key: "approve", label: "Duyệt", doneBy: "Người duyệt theo cấp" },
  { key: "pay", label: "Chi", doneBy: "Kế toán" },
] as const;

export const settlementStatusMeta: Record<SettlementStatus, { label: string; tone: StatusTone }> = {
  "chua-quyet-toan": { label: "Chưa quyết toán", tone: "neutral" },
  "dang-quyet-toan": { label: "Đang quyết toán", tone: "warning" },
  "da-quyet-toan": { label: "Đã quyết toán", tone: "success" },
};

export interface ApprovalTier {
  id: string;
  label: string;
  /** Giá trị tối đa của cấp (VND); cấp cuối không giới hạn */
  maxVnd: number;
  approver: string;
  roles: Role[];
}

/**
 * NGƯỠNG DUYỆT CHI: CẦN CẤU HÌNH. Tài liệu ghi chưa có ngưỡng tiền và chưa có mẫu đề nghị chi; chỉ có lời của Vận hành
 * rằng công nợ vượt "1 tỷ" thì xin Ban GĐ duyệt (đơn vị tiền chưa xác nhận). Các cấp dưới đây chỉ để mô phỏng luồng duyệt,
 * KHÔNG phải quy định của SpeeGo. Ban GĐ chốt rồi sửa tại đây và đặt configured = true.
 */
export const paymentApproval = {
  configured: false,
  tiers: [
    { id: "t1", label: "Cấp 1", maxVnd: 100_000_000, approver: "Trưởng phòng Vận hành", roles: ["van-hanh", "ban-gd", "admin"] },
    { id: "t2", label: "Cấp 2", maxVnd: 1_000_000_000, approver: "Ban Giám đốc", roles: ["ban-gd", "admin"] },
    { id: "t3", label: "Cấp 3", maxVnd: Number.POSITIVE_INFINITY, approver: "Ban Giám đốc", roles: ["ban-gd", "admin"] },
  ] as ApprovalTier[],
};

export const tierFor = (amount: number) => paymentApproval.tiers.find((t) => amount <= t.maxVnd) ?? paymentApproval.tiers.at(-1)!;

export type AccountingAction = "pay.create" | "pay.pay" | "ledger.write";

/**
 * Quyền thao tác Kế toán trong demo. Nhập: Vận hành. Duyệt: theo cấp ở trên. Chi và ghi sổ: chỉ Kế toán.
 * Xác nhận "Đã cọc" dùng quyền deposit.confirm của CRM (chỉ Kế toán). Quyền thật do backend quyết định.
 */
export const accountingPermissions: Record<AccountingAction, Role[]> = actionPermissions;

export const accountingDisclaimer =
  "Chỉ ghi nhận trạng thái trên hệ thống. Không có thao tác chuyển tiền hay thanh toán thật, và sao kê là dữ liệu demo.";
