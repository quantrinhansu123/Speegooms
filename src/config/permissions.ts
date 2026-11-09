import type { Role } from "../types/role";

/** Chỉ điều khiển FE demo. Backend phải kiểm quyền, phạm vi bản ghi và điều kiện chuyển bước độc lập. */
const sales: Role[] = ["sale-vn", "sale-global", "admin"];
export const actionPermissions = {
  "lead.write": sales, "rfq.write": sales, "quote.write": sales, "contract.write": sales, "deposit.request": sales,
  "deposit.confirm": ["ke-toan"], "board.approve": ["ban-gd", "admin"],
  "quote.review": ["sale-vn", "sale-global", "ban-gd", "admin"],
  "ops.write": ["van-hanh", "sourcing", "admin"], "price.return": ["van-hanh", "sourcing", "admin"],
  "wh.write": ["van-hanh", "admin"], "inquiry.create": sales,
  "pay.create": ["van-hanh", "ke-toan", "admin"], "pay.pay": ["ke-toan"], "ledger.write": ["ke-toan", "admin"],
  "payroll.write": ["ke-toan", "admin"], "expense.write": ["ke-toan", "admin"],
  "marketing.write": ["marketing", "admin"], "feedback.write": sales,
  "complaints.write": ["van-hanh", "ban-gd", "admin"], "hrm.write": ["hcns", "admin"], "legal.write": ["phap-che", "admin"],
} satisfies Record<string, Role[]>;
export type Action = keyof typeof actionPermissions;
export const canPerform = (role: Role, action: Action) => (actionPermissions[action] as readonly Role[]).includes(role);
