import { Star } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { docStatusMeta, poStatusMeta, qcResultMeta, requestStatusMeta, shipmentStatusMeta, supplierStatusMeta } from "@/config/operations";
import { orderStages, type OrderStage } from "@/services/ops/rules";
import type { DocStatus, PoStatus, QcResult, RequestStatus, ShipmentStatus, SupplierStatus } from "@/types/ops";
import type { StatusTone } from "@/types/status";

export const SupplierBadge = ({ value }: { value: SupplierStatus }) => <StatusBadge tone={supplierStatusMeta[value].tone}>{supplierStatusMeta[value].label}</StatusBadge>;
export const RequestBadge = ({ value }: { value: RequestStatus }) => <StatusBadge tone={requestStatusMeta[value].tone}>{requestStatusMeta[value].label}</StatusBadge>;
export const PoBadge = ({ value }: { value: PoStatus }) => <StatusBadge tone={poStatusMeta[value].tone}>{poStatusMeta[value].label}</StatusBadge>;
export const QcBadge = ({ value }: { value: QcResult }) => <StatusBadge tone={qcResultMeta[value].tone}>{qcResultMeta[value].label}</StatusBadge>;
export const DocBadge = ({ value }: { value: DocStatus }) => <StatusBadge tone={docStatusMeta[value].tone}>{docStatusMeta[value].label}</StatusBadge>;
export const ShipmentBadge = ({ value }: { value: ShipmentStatus }) => <StatusBadge tone={shipmentStatusMeta[value].tone}>{shipmentStatusMeta[value].label}</StatusBadge>;

const stageTone: Record<OrderStage, StatusTone> = {
  "cho-coc": "warning",
  "cho-ban-giao": "warning",
  "cho-dat-xuong": "info",
  "dang-san-xuat": "info",
  "chuan-bi-van-chuyen": "info",
  "dang-van-chuyen": "info",
  "thong-quan": "warning",
  "da-giao": "success",
};
export const StageBadge = ({ value }: { value: OrderStage }) => <StatusBadge tone={stageTone[value]}>{orderStages.find((s) => s.key === value)!.label}</StatusBadge>;

/** Đánh giá xưởng dạng sao kèm số, đọc được bằng trình đọc màn hình. */
export function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Đánh giá ${value} trên 5`}>
      <Star aria-hidden className="size-3.5 fill-brand-orange text-brand-orange" />
      <span className="tabular font-medium">{value.toFixed(1)}</span>
    </span>
  );
}
