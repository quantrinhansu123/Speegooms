import type { Role } from "../types/role";

export const reportConfig = {
  conversion: { label: "Lead conversion", roles: ["admin", "ban-gd", "marketing", "sale-vn", "sale-global"], description: "Cohort theo ngày tạo lead. Đếm lead duy nhất có RFQ chưa hủy / hợp đồng đã ký; trạng thái hiện tại, không phải ảnh chụp lịch sử." },
  sales: { label: "Hiệu quả Sale Việt Nam / Global", roles: ["admin", "ban-gd", "sale-vn", "sale-global"], description: "Lead theo ngày tạo và người phụ trách hiện tại. Giá trị các hợp đồng đã ký của tập lead đó tách VND/USD; không quy đổi tiền tệ." },
  marketing: { label: "Hiệu suất nguồn Marketing", roles: ["admin", "ban-gd", "marketing"], description: "Ads, Google, Organic theo cohort ngày tạo lead. Chưa có gán lead–chiến dịch nên chưa tính CPL, ROI hoặc ROAS." },
  orders: { label: "Số lượng & tiến độ đơn hàng", roles: ["admin", "ban-gd", "sale-vn", "sale-global", "van-hanh", "ke-toan"], description: "Đơn có hợp đồng đã ký theo ngày tạo hợp đồng; tiến độ hiện tại lấy từ cọc, bàn giao, PO và lô hàng." },
  shipments: { label: "Tình trạng lô hàng", roles: ["admin", "ban-gd", "sale-vn", "sale-global", "van-hanh"], description: "Lọc theo ETD dự kiến; trạng thái hiện tại từ các mốc lô hàng. Tracking mẫu, không có dữ liệu hãng thời gian thực." },
  ontime: { label: "Tỷ lệ giao đúng hạn", roles: ["admin", "ban-gd", "sale-vn", "sale-global", "van-hanh"], description: "Đề xuất chỉ số: lượt giao thành công có POD, lọc theo ngày giao thực tế; so ngày giao với hạn đơn. Chưa có hạn được hiển thị nhưng loại khỏi mẫu số." },
  debts: { label: "Công nợ", roles: ["admin", "ban-gd", "ke-toan"], description: "Số dư hiện tại của hợp đồng/đề nghị chi được tạo trong kỳ, không phải số dư lịch sử cuối kỳ. Dùng nguyên quy tắc phải thu/phải trả của Kế toán; VND (seed hiện tại)." },
  suppliers: { label: "Hiệu quả nhà cung cấp", roles: ["admin", "ban-gd", "van-hanh"], description: "PO theo ngày tạo. Điểm và tỷ lệ đúng hạn trong hồ sơ nhà cung cấp là mock toàn kỳ; chưa có ngày hoàn tất PO để tính SLA theo kỳ." },
} satisfies Record<string, { label: string; roles: Role[]; description: string }>;
export type ReportKey = keyof typeof reportConfig;
export const canViewReport = (role: Role, report: ReportKey) => (reportConfig[report].roles as readonly Role[]).includes(role);
