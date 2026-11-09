import { z } from "zod";

/** Danh mục lấy từ sheet DanhMuc_TrangThai của file Tong_hop_Thong_tin_data_khach_hang.xlsx. */
export const facebookStatuses = [
  "0. Chưa liên hệ",
  "1. Đã gửi tin nhắn (Chờ phản hồi)",
  "2. Đã follow-up (Nhắn lại ≥2 lần)",
  "3. Đang chat / Trao đổi nhu cầu",
  "4. Đã gửi thông tin / Catalog / Mẫu",
  "5. Tiềm năng cao (Hẹn gọi / Lấy SĐT)",
  "6. Đã gọi --> chuyển Telesale",
  "7. Không phản hồi / Đã seen",
  "8. Từ chối / Không có nhu cầu",
  "9. Sai tệp / Khóa nick / Chặn",
] as const;

export const telesaleStatuses = [
  "0. Chưa gọi",
  "1. Không nghe máy (Lần 1-2)",
  "2. Không nghe máy (Để lại Voice mail/SMS)",
  "3. Thuê bao / Sai số / Khóa máy",
  "4. Hẹn gọi lại (Khách đang bận/làm nail)",
  "5. Đã kết nối - Đang tư vấn",
  "6. Đã gửi báo giá / Kết bạn Zalo-WhatsApp",
  "7. Khách tiềm năng (Đang cân nhắc chốt)",
  "8. Chốt đơn thành công",
  "9. Từ chối (Giá cao / Đã có mối / Không mua)",
  "10. Sai tệp / Đã đổi nghề / Sang tiệm",
] as const;

export function hasActiveTelesale(status: string | null | undefined): status is (typeof telesaleStatuses)[number] {
  return telesaleStatuses.slice(1).some((value) => value === status);
}

export const customerClasses = ["Đã mua hàng", "Đã liên hệ, chưa mua", "Chưa liên hệ"] as const;

const customerFields = {
    fullName: z.string().trim().max(200, "Tên khách tối đa 200 ký tự").nullable().optional(),
    company: z.string().trim().max(200, "Tên tiệm tối đa 200 ký tự").nullable().optional(),
    phone: z.string().trim().max(40, "SĐT tối đa 40 ký tự").nullable().optional(),
    facebookLink: z.string().trim().max(500, "Link Facebook tối đa 500 ký tự").nullable().optional(),
    market: z.string().trim().max(200, "Thị trường tối đa 200 ký tự").nullable().optional(),
    segment: z.string().trim().max(200, "Mảng kinh doanh tối đa 200 ký tự").nullable().optional(),
    address: z.string().trim().max(500, "Địa chỉ tối đa 500 ký tự").nullable().optional(),
    interest: z.string().trim().max(500, "Mặt hàng quan tâm tối đa 500 ký tự").nullable().optional(),
    customerClass: z.enum(customerClasses).nullable().optional(),
    history: z.string().trim().max(5000, "Lịch sử CSKH tối đa 5000 ký tự").nullable().optional(),
    note: z.string().trim().max(2000, "Ghi chú tối đa 2000 ký tự").nullable().optional(),
};

/** Intern cập nhật trạng thái và bổ sung thông tin khách sau khi liên hệ; null hoặc rỗng = xóa. Trường không gửi thì giữ nguyên. */
export const updateDataLanhSchema = z
  .object({
    facebookStatus: z.enum(facebookStatuses).nullable().optional(),
    telesaleStatus: z.enum(telesaleStatuses).nullable().optional(),
    ...customerFields,
  })
  .refine((v) => Object.values(v).some((value) => value !== undefined), "Chọn thông tin cần cập nhật");
export type UpdateDataLanhInput = z.infer<typeof updateDataLanhSchema>;

/** Thêm khách mới: cần ít nhất tên hoặc số điện thoại. */
export const createDataLanhSchema = z
  .object(customerFields)
  .refine((v) => Boolean(v.fullName?.trim() || v.phone?.trim()), "Nhập tên khách hoặc số điện thoại");
export type CreateDataLanhInput = z.infer<typeof createDataLanhSchema>;

/** Bàn giao khách cho một Sale cụ thể để care tiếp. */
export const handoverDataLanhSchema = z.object({ saleId: z.string().trim().min(1, "Chọn Sale care").max(64) });
export type HandoverDataLanhInput = z.infer<typeof handoverDataLanhSchema>;

export type DataLanhRecord = {
  id: string;
  stt: number;
  fullName: string | null;
  company: string | null;
  phone: string | null;
  facebookLink: string | null;
  market: string | null;
  segment: string | null;
  customerClass: string | null;
  address: string | null;
  interest: string | null;
  history: string | null;
  note: string | null;
  internId: string | null;
  internName: string | null;
  facebookStatus: string | null;
  telesaleStatus: string | null;
  assignedAt: string | null;
  saleCareId: string | null;
  saleCareName: string | null;
  handedOverAt: string | null;
};
