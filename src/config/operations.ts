import { actionPermissions } from "./permissions.ts";
import type { Role } from "@/types/role";
import type { StatusTone } from "@/types/status";
import type {
  DocStatus,
  DocType,
  MilestoneKey,
  PoStatus,
  QcResult,
  RequestStatus,
  ShipmentStatus,
  SupplierStatus,
} from "@/types/ops";
import type { TransportMode } from "@/types/crm";

export const countryLabels = { VN: "Việt Nam", CN: "Trung Quốc" } as const;

export const supplierCategories = ["Hàng gia dụng", "Phụ kiện điện thoại", "Quần áo thời trang", "Linh kiện điện tử", "Đồ chơi trẻ em", "Dụng cụ làm đẹp", "Thiết bị văn phòng", "Đồ nội thất nhỏ"];

export const supplierStatusMeta: Record<SupplierStatus, { label: string; tone: StatusTone }> = {
  "dang-hop-tac": { label: "Đang hợp tác", tone: "success" },
  "theo-doi": { label: "Cần theo dõi", tone: "warning" },
  "tam-dung": { label: "Tạm dừng", tone: "danger" },
};

export const requestStatusMeta: Record<RequestStatus, { label: string; tone: StatusTone }> = {
  moi: { label: "Mới nhận", tone: "neutral" },
  "dang-tim": { label: "Đang tìm xưởng", tone: "warning" },
  "co-bao-gia": { label: "Có báo giá", tone: "info" },
  "da-chon": { label: "Đã chọn xưởng", tone: "success" },
  huy: { label: "Đã hủy", tone: "danger" },
};

/** Thứ tự tiến độ PO. "huy" nằm ngoài chuỗi. */
export const poFlow: PoStatus[] = ["nhap", "da-gui", "xac-nhan", "dang-san-xuat", "qc", "san-sang", "da-giao-vc"];

export const poStatusMeta: Record<PoStatus, { label: string; tone: StatusTone }> = {
  nhap: { label: "Nháp", tone: "neutral" },
  "da-gui": { label: "Đã đặt xưởng", tone: "info" },
  "xac-nhan": { label: "Xưởng xác nhận", tone: "info" },
  "dang-san-xuat": { label: "Đang sản xuất", tone: "warning" },
  qc: { label: "Đang QC", tone: "warning" },
  "san-sang": { label: "Hàng sẵn sàng", tone: "success" },
  "da-giao-vc": { label: "Đã giao vận chuyển", tone: "success" },
  huy: { label: "Đã hủy", tone: "danger" },
};

/**
 * Checklist bàn giao Sale → Vận hành, lấy từ "Phiếu bàn giao" trong tài liệu (mục 3.7 bước 4).
 * Thiếu mục nào thì Vận hành trả lại, không bắt đầu. SLA xác nhận (X giờ) chưa chốt nên không hiển thị.
 */
export const handoverItems = [
  { id: "i1", label: "Hợp đồng đã ký" },
  { id: "i2", label: "Báo giá khách đã chấp nhận" },
  { id: "i3", label: "Danh sách hàng" },
  { id: "i4", label: "Xưởng và địa chỉ nhận hàng" },
  { id: "i5", label: "Địa chỉ giao hàng (có ZIP)" },
  { id: "i6", label: "Hạn giao" },
  { id: "i7", label: "Yêu cầu đặc biệt" },
  { id: "i8", label: "Đã xác định hàng nhạy cảm hay không" },
  { id: "i9", label: "Giá tách tiền hàng / cước" },
] as const;

/**
 * QC checklist: CẤU HÌNH TẠM. Tài liệu chỉ nêu QC cần PO, mẫu, ảnh/video; chưa có tiêu chuẩn QC được duyệt.
 * Sửa tại đây khi Vận hành chốt tiêu chí.
 */
export const qcItems = [
  { id: "q1", label: "Số lượng khớp PO" },
  { id: "q2", label: "Quy cách / mẫu đã duyệt" },
  { id: "q3", label: "Ngoại quan sản phẩm" },
  { id: "q4", label: "Đóng gói" },
  { id: "q5", label: "Nhãn mác, thông tin in" },
  { id: "q6", label: "Ảnh / video hàng thật" },
] as const;
export const qcApproved = false;

export const qcResultMeta: Record<QcResult, { label: string; tone: StatusTone }> = {
  cho: { label: "Chờ kiểm", tone: "neutral" },
  dat: { label: "Đạt", tone: "success" },
  "khong-dat": { label: "Không đạt", tone: "danger" },
  "khong-ap-dung": { label: "Không áp dụng", tone: "info" },
};

export const modeLabels: Record<TransportMode, string> = { air: "Hàng không", "sea-lcl": "Đường biển LCL", "sea-fcl": "Đường biển FCL" };

/** 6 mốc lô hàng theo yêu cầu: nhận hàng, xuất kho, vận chuyển quốc tế, thông quan, đến kho, giao hàng. */
export const milestones: { key: MilestoneKey; label: string }[] = [
  { key: "receive", label: "Nhận hàng" },
  { key: "dispatch", label: "Xuất kho" },
  { key: "international", label: "Vận chuyển quốc tế" },
  { key: "customs", label: "Thông quan" },
  { key: "arrive", label: "Đến kho" },
  { key: "deliver", label: "Giao hàng" },
];

export const shipmentStatusMeta: Record<ShipmentStatus, { label: string; tone: StatusTone }> = {
  "chua-nhan": { label: "Chưa nhận hàng", tone: "neutral" },
  "dang-xu-ly": { label: "Đang xử lý", tone: "info" },
  "dang-van-chuyen": { label: "Đang vận chuyển quốc tế", tone: "info" },
  "thong-quan": { label: "Đã thông quan", tone: "warning" },
  "da-den-kho": { label: "Đã đến kho", tone: "warning" },
  "da-giao": { label: "Đã giao", tone: "success" },
};

/**
 * Chứng từ lô hàng: CẤU HÌNH TẠM theo loại hình. Tài liệu có nhắc chứng từ XNK, kiểm hóa, thông quan
 * nhưng chưa có danh mục chứng từ bắt buộc được duyệt.
 */
export const docTypeLabels: Record<DocType, string> = {
  invoice: "Hóa đơn thương mại",
  "packing-list": "Packing list",
  awb: "Vận đơn hàng không (AWB)",
  bl: "Vận đơn đường biển (B/L)",
  customs: "Tờ khai hải quan",
};
export const requiredDocs = (mode: TransportMode): DocType[] => ["invoice", "packing-list", mode === "air" ? "awb" : "bl", "customs"];

export const docStatusMeta: Record<DocStatus, { label: string; tone: StatusTone }> = {
  thieu: { label: "Thiếu", tone: "danger" },
  "cho-duyet": { label: "Chờ duyệt", tone: "warning" },
  "da-duyet": { label: "Đã duyệt", tone: "success" },
  "tu-choi": { label: "Bị từ chối", tone: "danger" },
};

export const costLabels = { freight: "Cước vận chuyển", customs: "Thuế/phí hải quan", handling: "Phí kho, xử lý", other: "Chi phí khác" } as const;

export type OpsAction = "ops.write" | "price.return";

/** Quyền thao tác Vận hành trong demo. Ban GĐ chỉ xem. Quyền thật do backend quyết định. */
export const opsPermissions: Record<OpsAction, Role[]> = actionPermissions;

/** Nhãn bắt buộc cho dữ liệu tracking: không có nguồn thời gian thực. */
export const trackingDisclaimer = "Dữ liệu tracking là dữ liệu demo hoặc nhập tay, không phải theo dõi thời gian thực từ hãng vận chuyển.";
