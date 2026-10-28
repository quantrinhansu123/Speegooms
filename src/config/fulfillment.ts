import { actionPermissions } from "./permissions.ts";
import type { Role } from "@/types/role";
import type { StatusTone } from "@/types/status";
import type { DeliveryStatus, InquiryStatus, OutboundStatus, PackageStatus, ReceiptStatus } from "@/types/fulfillment";

export const receiptStatusMeta: Record<ReceiptStatus, { label: string; tone: StatusTone }> = {
  "cho-nhap": { label: "Chờ nhập kho", tone: "warning" },
  "da-nhap": { label: "Đã nhập kho", tone: "success" },
  lech: { label: "Nhập lệch số lượng", tone: "danger" },
};

export const packageStatusMeta: Record<PackageStatus, { label: string; tone: StatusTone }> = {
  "trong-kho": { label: "Trong kho", tone: "info" },
  "da-giu-cho": { label: "Đã giữ chỗ pick", tone: "warning" },
  "da-pick": { label: "Đã pick", tone: "warning" },
  "da-dong-goi": { label: "Đã đóng gói", tone: "warning" },
  "da-xuat": { label: "Đã xuất kho", tone: "info" },
  "da-giao": { label: "Đã giao", tone: "success" },
};

/** Kiện còn nằm trong kho (chưa xuất): dùng cho bảng tồn kho. */
export const inStockStatuses: PackageStatus[] = ["trong-kho", "da-giu-cho", "da-pick", "da-dong-goi"];

export const outboundStatusMeta: Record<OutboundStatus, { label: string; tone: StatusTone }> = {
  "cho-pick": { label: "Chờ pick", tone: "neutral" },
  "dang-pick": { label: "Đang pick", tone: "warning" },
  "da-pick": { label: "Đã pick, chờ đóng gói", tone: "warning" },
  "da-dong-goi": { label: "Đã đóng gói, chờ giao", tone: "info" },
  "da-xuat": { label: "Đã xuất kho", tone: "success" },
};

/** Thứ tự bước Pick/Pack hiển thị trên workflow. */
export const outboundFlow: { key: OutboundStatus; label: string }[] = [
  { key: "cho-pick", label: "Tạo lệnh, giữ chỗ" },
  { key: "dang-pick", label: "Đang pick" },
  { key: "da-pick", label: "Pick xong" },
  { key: "da-dong-goi", label: "Đóng gói" },
  { key: "da-xuat", label: "Giao đối tác giao" },
];

export const deliveryStatusMeta: Record<DeliveryStatus, { label: string; tone: StatusTone }> = {
  "dang-giao": { label: "Đang giao", tone: "info" },
  "da-giao": { label: "Đã giao (có POD)", tone: "success" },
  "giao-that-bai": { label: "Giao không thành", tone: "danger" },
};

export const inquiryStatusMeta: Record<InquiryStatus, { label: string; tone: StatusTone }> = {
  moi: { label: "Chưa xử lý", tone: "warning" },
  "dang-xu-ly": { label: "Đang xử lý", tone: "info" },
  "da-tra-loi": { label: "Đã trả lời", tone: "success" },
};

export const lastMileCarriers = ["Giao chặng cuối Đối tác A (demo)", "Giao chặng cuối Đối tác B (demo)", "Giao chặng cuối Đối tác C (demo)"];

/** Hàng về kho đã quá số ngày này mà chưa nhập kho thì cảnh báo. Số ngày chỉ để demo, chưa có SLA kho trong tài liệu. */
export const inboundAlertDays = 2;

export type FulfillmentAction = "wh.write" | "inquiry.create";

/** Quyền thao tác Fulfillment trong demo. Sale chỉ được tạo yêu cầu hỏi tình trạng. Quyền thật do backend quyết định. */
export const fulfillmentPermissions: Record<FulfillmentAction, Role[]> = actionPermissions;
