import { canViewReport, reportConfig, type ReportKey } from "./reports";
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
    ],
  },
  marketing: { label: "Marketing", dashboard: "department", department: "marketing", modules: ["/dashboard", "/marketing", "/crm/mess"] },
  "sale-vn": {
    label: "Sale Việt Nam",
    dashboard: "department",
    department: "sale-vn",
    modules: ["/dashboard", "/crm", "/sale-viet-nam", "/khach-hang-dieu-phoi", "/marketing/phan-hoi", "/khieu-nai"],
  },
  "sale-global": {
    label: "Sale Global",
    dashboard: "department",
    department: "sale-global",
    modules: ["/dashboard", "/crm", "/sale-global", "/khach-hang-dieu-phoi", "/marketing/phan-hoi", "/khieu-nai"],
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
    ],
  },
  sourcing: {
    label: "Sourcing",
    dashboard: "department",
    department: "van-hanh",
    modules: [
      "/dashboard",
      "/van-hanh/sourcing-bao-gia",
      "/sale-viet-nam/tiem-nang",
      "/sale-global/tiem-nang",
      "/khieu-nai",
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
    ],
  },
  "ke-toan": { label: "Kế toán", dashboard: "department", department: "ke-toan", modules: ["/dashboard", "/ke-toan", "/crm/hop-dong"] },
  hcns: { label: "HCNS", dashboard: "department", department: "hcns", modules: ["/dashboard", "/hcns"] },
  "phap-che": { label: "Pháp chế", dashboard: "department", department: "phap-che", modules: ["/dashboard", "/phap-che"] },
};

/** Theo dõi báo giá theo tuyến: /theo-doi-bao-gia/vn|global/:potentialId */
const TRACKING_HREF = /^\/theo-doi-bao-gia\/(vn|global)(\/|$)/;

export function canAccess(role: Role, href: string): boolean {
  if (href === "/demo-guide" || href.startsWith("/demo-guide/")) return true;
  if (href === "/cai-dat") return true;
  if (href === "/reports" || href.startsWith("/reports/")) return (Object.keys(reportConfig) as ReportKey[]).some((key) => canViewReport(role, key));
  if (TRACKING_HREF.test(href)) {
    return role === "admin" || role === "ban-gd" || role === "sale-vn" || role === "sale-global" || role === "van-hanh" || role === "sourcing" || role === "logistics";
  }
  const { modules } = roleConfig[role];
  return modules === "*" || modules.some((m) => href === m || href.startsWith(`${m}/`));
}

/** Menu sidebar đã lọc theo vai trò (cả mục con); bỏ mục/nhóm rỗng. */
export function navigationForRole(role: Role): NavGroup[] {
  return navigation
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => i.href !== "/crm" && i.href !== "/fulfillment")
        .map((i) => ({ ...i, children: i.children?.filter((c) => canAccess(role, c.href)) }))
        .filter((i) => (i.children ? i.children.length > 0 : canAccess(role, i.href))),
    }))
    .filter((g) => g.items.length > 0);
}
