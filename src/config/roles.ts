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
      "/khieu-nai",
      "/de-xuat",
    ],
  },
  marketing: { label: "Marketing", dashboard: "department", department: "marketing", modules: ["/dashboard", "/marketing", "/crm/mess", "/de-xuat"] },
  "sale-vn": {
    label: "Sale Việt Nam",
    dashboard: "department",
    department: "sale-vn",
    modules: ["/dashboard", "/crm", "/sale-viet-nam", "/khach-hang-dieu-phoi", "/marketing/phan-hoi", "/khieu-nai", "/de-xuat"],
  },
  "sale-intern": { label: "Sales Intern", dashboard: "tasks-only", modules: ["/dashboard", "/sale-viet-nam/data-lanh", "/de-xuat"] },
  "sale-global": {
    label: "Sale Global",
    dashboard: "department",
    department: "sale-global",
    modules: ["/dashboard", "/crm", "/sale-global", "/khach-hang-dieu-phoi", "/marketing/phan-hoi", "/khieu-nai", "/de-xuat"],
  },
  "van-hanh": {
    label: "Vận hành",
    dashboard: "department",
    department: "van-hanh",
    modules: [
      "/dashboard",
      "/van-hanh",
      "/fulfillment",
      "/sale-viet-nam/tiem-nang",
      "/sale-global/tiem-nang",
      "/khieu-nai",
      "/ke-toan/de-nghi-thanh-toan",
      "/ke-toan/duyet-thanh-toan",
      "/de-xuat",
    ],
  },
  sourcing: {
    label: "Sourcing",
    dashboard: "department",
    department: "van-hanh",
    modules: [
      "/dashboard",
      "/van-hanh/sourcing-bao-gia",
      "/van-hanh/don-hang",
      "/van-hanh/nha-cung-cap",
      "/van-hanh/po",
      "/sale-viet-nam/tiem-nang",
      "/sale-global/tiem-nang",
      "/khieu-nai",
      "/de-xuat",
    ],
  },
  logistics: {
    label: "Logistics",
    dashboard: "department",
    department: "van-hanh",
    modules: [
      "/dashboard",
      "/van-hanh/sourcing-bao-gia",
      "/van-hanh/logistics-bao-gia",
      "/sale-viet-nam/tiem-nang",
      "/sale-global/tiem-nang",
      "/khieu-nai",
      "/de-xuat",
    ],
  },
  "ke-toan": { label: "Kế toán", dashboard: "department", department: "ke-toan", modules: ["/dashboard", "/ke-toan", "/crm/hop-dong", "/van-hanh/sourcing-bao-gia", "/van-hanh/logistics-bao-gia", "/de-xuat"] },
  hcns: { label: "HCNS", dashboard: "department", department: "hcns", modules: ["/dashboard", "/hcns", "/de-xuat"] },
  "phap-che": { label: "Pháp chế", dashboard: "department", department: "phap-che", modules: ["/dashboard", "/phap-che", "/de-xuat"] },
};

/** Theo dõi báo giá theo tuyến: /theo-doi-bao-gia/vn|global/:potentialId */
const TRACKING_HREF = /^\/theo-doi-bao-gia\/(vn|global)(\/|$)/;

export function canAccess(role: Role, href: string): boolean {
  if (["/cai-dat", "/reports", "/demo-guide", "/coa", "/khach-hang-dieu-phoi"].some((path) => href === path || href.startsWith(`${path}/`))) return role === "admin";
  if (TRACKING_HREF.test(href)) {
    return role === "admin" || role === "ban-gd" || role === "sale-vn" || role === "sale-global" || role === "van-hanh" || role === "sourcing" || role === "logistics";
  }
  const { modules } = roleConfig[role];
  return modules === "*" || modules.some((m) => href === m || href.startsWith(`${m}/`));
}

/** Menu sidebar đã lọc theo vai trò (cả mục con); bỏ mục/nhóm rỗng. */
export function navigationForRole(role: Role): NavGroup[] {
  return navigation
    .filter((g) => role === "admin" || !g.items.some((item) => item.href === "/cai-dat" || item.href === "/reports"))
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => i.href !== "/crm" && i.href !== "/fulfillment")
        .map((i) => ({ ...i, children: i.children?.filter((c) => canAccess(role, c.href)) }))
        .filter((i) => (i.children ? i.children.length > 0 : canAccess(role, i.href))),
    }))
    .filter((g) => g.items.length > 0);
}
