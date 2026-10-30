import type { Role } from "@speego/shared";

export const permissions = {
  "user.role.assign": ["admin"],
  "message.read": ["admin", "ban-gd", "marketing", "sale-vn", "sale-global"],
  "message.write": ["admin", "marketing", "sale-vn", "sale-global"],
  "message.convert": ["admin", "sale-vn", "sale-global"],
  "potential.read": ["admin", "ban-gd", "sale-vn", "sale-global"],
  "potential.write": ["admin", "sale-vn", "sale-global"],
  "quote.read": ["admin", "ban-gd", "van-hanh"],
  "quote.rfq": ["admin", "ban-gd", "sale-vn", "sale-global"],
  "quote.request": ["admin", "sale-vn", "sale-global"],
  "quote.logistics": ["admin", "van-hanh"],
  /** Sale / VH điền ảnh, số lượng, quy cách, thông số đơn hàng (không gửi báo giá). */
  "quote.content": ["admin", "sale-vn", "sale-global", "van-hanh"],
  "quote.ops": ["admin", "van-hanh"],
  "quote.return": ["admin", "sale-vn", "sale-global"],
  "contract.read": ["admin", "ban-gd", "sale-vn", "sale-global", "van-hanh", "ke-toan"],
  "contract.create": ["admin", "sale-vn", "sale-global"],
  "contract.ops": ["admin", "van-hanh"],
  "contract.accounting": ["admin", "ke-toan"],
  "contract.delete": ["ke-toan"],
  "contract.resend": ["admin", "sale-vn", "sale-global", "van-hanh", "ke-toan"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

export function can(role: Role, action: Permission): boolean {
  return (permissions[action] as readonly Role[]).includes(role);
}
