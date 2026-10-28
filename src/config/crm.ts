import type { Role } from "@/types/role";
import type {
  ApprovalState,
  CareStatus,
  ContractStatus,
  DepositStatus,
  GoodsOrigin,
  LeadSource,
  LostReason,
  QuoteStatus,
  RfqStatus,
  RouteCode,
  Temperature,
  TransportMode,
} from "@/types/crm";
import type { StatusTone } from "@/types/status";

/** "Hôm nay" của dữ liệu mock (khớp dashboard). */
export const CRM_TODAY = "2026-10-28";

/**
 * 6 thông tin cần hỏi khi nhận mess.
 * CHƯA DUYỆT: tài liệu nghiệp vụ nêu "đủ 6 thông tin" nhưng tiêu chí chi tiết chưa chốt (câu Q20).
 * Danh sách dưới đây là cấu hình tạm để dựng form; sửa tại đây khi Marketing/Ban GĐ chốt, form tự đổi theo.
 */
export const leadProfileFields = [
  { id: "f1", label: "Hàng hóa cần mua / vận chuyển", placeholder: "Tên và loại hàng" },
  { id: "f2", label: "Số lượng / khối lượng", placeholder: "Ví dụ: 500 cái, 2 CBM" },
  { id: "f3", label: "Xuất xứ hàng", placeholder: "Xưởng ở đâu" },
  { id: "f4", label: "Điểm giao hàng", placeholder: "Quốc gia, thành phố, ZIP" },
  { id: "f5", label: "Thời gian cần hàng", placeholder: "Mốc thời gian mong muốn" },
  { id: "f6", label: "Ngân sách / mức giá kỳ vọng", placeholder: "Nếu khách đã nêu" },
] as const;

export const leadProfileApproved = false;
/** Tài liệu: "đủ 6 thông tin mới sang Hot". Đặt false nếu muốn chỉ cảnh báo thay vì chặn. */
export const enforceProfileForHot = true;

export const sourceLabels: Record<LeadSource, string> = {
  ads: "Ads (Meta)",
  google: "Google",
  organic: "Organic",
  affiliate: "Affiliate (đề xuất)",
};
/** Affiliate chưa có quy trình nên không chọn được. */
export const activeSources: LeadSource[] = ["ads", "google", "organic"];

export const temperatureMeta: Record<Temperature, { label: string; tone: StatusTone }> = {
  hot: { label: "Hot", tone: "danger" },
  warm: { label: "Warm", tone: "warning" },
  cold: { label: "Cold", tone: "info" },
};

export const careStatusMeta: Record<CareStatus, { label: string; tone: StatusTone }> = {
  moi: { label: "Mới", tone: "info" },
  "dang-cham": { label: "Đang chăm", tone: "neutral" },
  "ngu-dong": { label: "Ngủ đông", tone: "warning" },
  "da-co-rfq": { label: "Đã có RFQ", tone: "success" },
  mat: { label: "Mất khách", tone: "danger" },
};

export const lostReasonLabels: Record<LostReason, string> = {
  gia: "Giá",
  "thoi-gian": "Thời gian",
  "niem-tin": "Niềm tin",
  "hang-chua-san-sang": "Hàng chưa sẵn sàng",
  khac: "Khác",
};

export const originLabels: Record<GoodsOrigin, string> = {
  vn: "Xưởng Việt Nam",
  cn: "Xưởng Trung Quốc",
  unknown: "Chưa rõ",
};

export const routeLabels: Record<RouteCode, string> = { vn: "Sale Việt Nam", global: "Sale Global" };

export const rfqStatusMeta: Record<RfqStatus, { label: string; tone: StatusTone }> = {
  moi: { label: "Mới tạo", tone: "neutral" },
  "cho-gia": { label: "Chờ giá hàng/cước", tone: "warning" },
  "da-co-gia": { label: "Đã có giá", tone: "info" },
  "da-bao-gia": { label: "Đã báo giá", tone: "info" },
  "da-chot": { label: "Đã chốt", tone: "success" },
  "da-huy": { label: "Đã hủy", tone: "danger" },
};

export const transportLabels: Record<TransportMode, string> = {
  air: "Hàng không",
  "sea-lcl": "Đường biển LCL",
  "sea-fcl": "Đường biển FCL",
};

export const quoteStatusMeta: Record<QuoteStatus, { label: string; tone: StatusTone }> = {
  nhap: { label: "Nháp", tone: "neutral" },
  "cho-duyet": { label: "Chờ duyệt", tone: "warning" },
  "da-gui": { label: "Đã gửi", tone: "info" },
  "chap-nhan": { label: "Khách chấp nhận", tone: "success" },
  "tu-choi": { label: "Khách từ chối", tone: "danger" },
};

export const approvalMeta: Record<ApprovalState, string> = {
  "khong-can": "Không cần duyệt",
  "cho-duyet": "Chờ duyệt",
  "da-duyet": "Đã duyệt",
  "bi-tu-choi": "Bị từ chối",
};

export const contractStatusMeta: Record<ContractStatus, { label: string; tone: StatusTone }> = {
  "soan-thao": { label: "Soạn thảo", tone: "neutral" },
  "da-ky": { label: "Đã ký", tone: "success" },
  huy: { label: "Đã hủy", tone: "danger" },
};

export const depositMeta: Record<DepositStatus, { label: string; tone: StatusTone }> = {
  "chua-yeu-cau": { label: "Chưa yêu cầu cọc", tone: "neutral" },
  "cho-ke-toan": { label: "Chờ Kế toán xác nhận", tone: "warning" },
  "da-coc": { label: "Đã cọc", tone: "success" },
  "khong-khop": { label: "Không khớp", tone: "danger" },
};

/**
 * CHỈ MÔ PHỎNG: tài liệu nêu có ngưỡng giảm giá (A) và ngưỡng hợp đồng (B) nhưng chưa chốt giá trị
 * (3.000 hay 4.000 USD...). Số dưới đây chỉ để demo luồng duyệt, KHÔNG phải quy định của SpeeGo.
 */
export const simulatedApprovals = {
  /** Ngưỡng A: giảm giá vượt % này thì cần Trưởng phòng Sale duyệt */
  quoteDiscountPercent: 5,
  /** Ngưỡng B: hợp đồng vượt giá trị này (VND) thì cần Ban GĐ duyệt */
  contractBoardVnd: 400_000_000,
  /** Tỷ lệ cọc mặc định gợi ý */
  depositPercent: 30,
};

export type CrmAction =
  | "lead.write"
  | "rfq.write"
  | "quote.write"
  | "contract.write"
  | "deposit.request"
  | "deposit.confirm"
  | "board.approve";

const sale: Role[] = ["sale-vn", "sale-global", "admin"];

/** Quyền thao tác trong demo. Chỉ Kế toán được xác nhận "Đã cọc". Quyền thật do backend quyết định. */
export const crmPermissions: Record<CrmAction, Role[]> = {
  "lead.write": sale,
  "rfq.write": sale,
  "quote.write": sale,
  "contract.write": sale,
  "deposit.request": sale,
  "deposit.confirm": ["ke-toan"],
  "board.approve": ["ban-gd", "admin"],
};

/** Phạm vi tuyến theo vai trò: Sale VN chỉ thấy tuyến VN, Sale Global chỉ thấy Global. */
export const roleRouteScope: Partial<Record<Role, RouteCode>> = {
  "sale-vn": "vn",
  "sale-global": "global",
};
