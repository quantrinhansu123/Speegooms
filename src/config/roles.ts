import { navigation } from "@/config/navigation";
import type { NavGroup } from "@/types/navigation";
import type { Department, Role } from "@/types/role";

export interface RoleConfig {
  label: string;
  /**
   * Phạm vi dashboard:
   * - all: toàn công ty, được lọc theo phòng
   * - department: khóa theo phòng của vai trò
   * - tasks-only: chưa có chỉ số nghiệp vụ, chỉ hiện công việc
   */
  dashboard: "all" | "department" | "tasks-only";
  department?: Department;
  /** Menu cấp 1 được truy cập; "*" là tất cả */
  modules: string[] | "*";
}

/** Cấu hình phân quyền menu tập trung, mock cho demo, không phải kiểm soát truy cập thật. */
export const roleConfig: Record<Role, RoleConfig> = {
  admin: { label: "Admin", dashboard: "all", modules: "*" },
  "ban-gd": {
    label: "Ban Giám đốc",
    dashboard: "all",
    modules: [
      "/dashboard",
      "/coa",
      "/khach-hang-dieu-phoi",
      "/crm",
      "/marketing",
      "/sale-viet-nam",
      "/sale-global",
      "/van-hanh",
      "/fulfillment",
      "/ke-toan",
      "/hcns",
      "/phap-che",
    ],
  },
  marketing: { label: "Marketing", dashboard: "department", department: "marketing", modules: ["/dashboard", "/marketing"] },
  "sale-vn": {
    label: "Sale Việt Nam",
    dashboard: "department",
    department: "sale-vn",
    modules: ["/dashboard", "/crm", "/sale-viet-nam", "/khach-hang-dieu-phoi"],
  },
  "sale-global": {
    label: "Sale Global",
    dashboard: "department",
    department: "sale-global",
    modules: ["/dashboard", "/crm", "/sale-global", "/khach-hang-dieu-phoi"],
  },
  "van-hanh": { label: "Vận hành", dashboard: "department", department: "van-hanh", modules: ["/dashboard", "/van-hanh", "/fulfillment", "/ke-toan/de-nghi-thanh-toan", "/ke-toan/duyet-thanh-toan"] },
  "ke-toan": { label: "Kế toán", dashboard: "department", department: "ke-toan", modules: ["/dashboard", "/ke-toan", "/crm/hop-dong"] },
  hcns: { label: "HCNS", dashboard: "tasks-only", department: "hcns", modules: ["/dashboard", "/hcns"] },
  "phap-che": { label: "Pháp chế", dashboard: "tasks-only", department: "phap-che", modules: ["/dashboard", "/phap-che"] },
};

export function canAccess(role: Role, href: string): boolean {
  const { modules } = roleConfig[role];
  return modules === "*" || modules.some((m) => href === m || href.startsWith(`${m}/`));
}

/** Menu sidebar đã lọc theo vai trò (cả mục con); bỏ mục/nhóm rỗng. */
export function navigationForRole(role: Role): NavGroup[] {
  return navigation
    .map((g) => ({
      ...g,
      items: g.items
        .map((i) => ({ ...i, children: i.children?.filter((c) => canAccess(role, c.href)) }))
        .filter((i) => (i.children ? i.children.length > 0 : canAccess(role, i.href))),
    }))
    .filter((g) => g.items.length > 0);
}
