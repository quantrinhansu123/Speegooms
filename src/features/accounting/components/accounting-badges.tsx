import { AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { paymentApproval, paymentStatusMeta, settlementStatusMeta } from "@/config/accounting";
import type { PaymentStatus, SettlementStatus } from "@/types/accounting";

export const PaymentBadge = ({ value }: { value: PaymentStatus }) => <StatusBadge tone={paymentStatusMeta[value].tone}>{paymentStatusMeta[value].label}</StatusBadge>;
export const SettlementBadge = ({ value }: { value: SettlementStatus }) => <StatusBadge tone={settlementStatusMeta[value].tone}>{settlementStatusMeta[value].label}</StatusBadge>;

/** Nhắc rõ ngưỡng duyệt chi chưa được cấu hình (tài liệu chưa có ngưỡng). */
export function ThresholdNotice({ compact = false }: { compact?: boolean }) {
  if (paymentApproval.configured) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>
        <strong className="font-semibold">Ngưỡng duyệt chi cần cấu hình.</strong>{" "}
        {compact
          ? "Các cấp duyệt hiện chỉ để mô phỏng, chưa phải quy định."
          : "Tài liệu nghiệp vụ chưa có ngưỡng tiền và mẫu đề nghị chi. Các cấp duyệt hiển thị chỉ để mô phỏng luồng, Ban GĐ chốt rồi sửa tại config/accounting.ts."}
      </p>
    </div>
  );
}
