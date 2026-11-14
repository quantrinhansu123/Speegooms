import type { Role } from "@speego/shared";

export const permissions = {
  "user.role.assign": ["admin"],
  "datalanh.read": ["admin", "ban-gd", "sale-vn", "sale-global", "sale-global-lead", "sale-intern"],
  "datalanh.create": ["admin", "sale-vn", "sale-global", "sale-global-lead"],
  /** Giao lại / chia vòng tròn data lạnh. */
  /** Xóa khách khỏi data lạnh (không hoàn tác). */
  "datalanh.delete": ["admin"],
  /** Bàn giao khách cho Sale care (intern chỉ dòng của mình). */
  "datalanh.handover": ["admin", "sale-vn", "sale-global", "sale-global-lead", "sale-intern"],
  "datalanh.assign": ["admin"],
  /** Cập nhật trạng thái chăm FB / Telesale (intern chỉ dòng của mình). */
  "datalanh.work": ["admin", "sale-vn", "sale-global", "sale-global-lead", "sale-intern"],
  /** Xem mọi đề xuất (tab Quản trị / Thống kê). Ai cũng được tạo và duyệt đề xuất được giao cho mình. */
  "proposal.review": ["admin", "ban-gd", "hcns"],
  /** Tạo / sửa / xóa mẫu đề xuất. */
  "proposal.template": ["admin", "hcns"],
  "message.read": ["admin", "ban-gd", "marketing", "sale-vn", "sale-global", "sale-global-lead"],
  "message.write": ["admin", "marketing", "sale-vn", "sale-global", "sale-global-lead"],
  "message.convert": ["admin", "sale-vn", "sale-global", "sale-global-lead"],
  "potential.read": ["admin", "ban-gd", "sale-vn", "sale-global", "sale-global-lead", "van-hanh", "sourcing", "logistics"],
  "potential.write": ["admin", "sale-vn", "sale-global", "sale-global-lead"],
  "quote.read": ["admin", "ban-gd", "van-hanh", "sourcing", "logistics", "ke-toan"],
  "quote.rfq": ["admin", "ban-gd", "sale-vn", "sale-global", "sale-global-lead"],
  "quote.request": ["admin", "sale-vn", "sale-global", "sale-global-lead"],
  "quote.logistics": ["admin", "van-hanh", "sourcing"],
  /** Sale / VH điền ảnh, số lượng, quy cách, thông số đơn hàng (không gửi báo giá). */
  "quote.content": ["admin", "sale-vn", "sale-global", "sale-global-lead", "van-hanh", "sourcing", "logistics"],
  /** Bật/tắt off cho bất kỳ nhân sự trong danh sách chia đơn (mỗi người luôn tự bật/tắt off của mình). */
  "quote.assign": ["admin", "van-hanh"],
  "quote.ops": ["admin", "van-hanh", "sourcing", "logistics"],
  "quote.return": ["admin", "sale-vn", "sale-global", "sale-global-lead"],
  "contract.read": ["admin", "ban-gd", "sale-vn", "sale-global", "sale-global-lead", "van-hanh", "sourcing", "ke-toan"],
  "contract.create": ["admin", "sale-vn", "sale-global", "sale-global-lead"],
  "contract.ops": ["admin", "van-hanh", "sourcing"],
  "contract.accounting": ["admin", "ke-toan"],
  "contract.delete": ["ke-toan"],
  "contract.resend": ["admin", "sale-vn", "sale-global", "sale-global-lead", "van-hanh", "sourcing", "ke-toan"],
  /** Kế toán: nhập (Vận hành hoặc Kế toán), duyệt và chi tách người. */
  "payment.read": ["admin", "ban-gd", "van-hanh", "ke-toan"],
  "payment.create": ["admin", "van-hanh", "ke-toan"],
  "payroll.read": ["admin", "ban-gd", "ke-toan"],
  "payroll.write": ["admin", "ke-toan"],
  "expense.read": ["admin", "ban-gd", "ke-toan"],
  "expense.write": ["admin", "ke-toan"],
  "ledger.read": ["admin", "ban-gd", "ke-toan"],
  "ledger.write": ["admin", "ke-toan"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

export function can(role: Role, action: Permission): boolean {
  return (permissions[action] as readonly Role[]).includes(role);
}
