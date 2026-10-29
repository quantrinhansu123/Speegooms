import {
  Briefcase,
  Compass,
  FileCheck2,
  Handshake,
  Globe2,
  LayoutDashboard,
  Megaphone,
  Settings2,
  Truck,
  Warehouse,
  UserCog,
  Users,
  Wallet,
  ChartNoAxesCombined,
  BookOpen,
} from "lucide-react";
import type { NavGroup } from "@/types/navigation";

/**
 * Cấu trúc module theo sơ đồ tổ chức SpeeGo (cơ cấu Ban GĐ 27/10/2026).
 * Thêm phòng/nhóm mới tại đây; Sidebar và Breadcrumb tự cập nhật.
 */
export const navigation: NavGroup[] = [
  {
    label: "Điều hành",
    items: [
      { title: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
      { title: "Reports", href: "/reports", icon: ChartNoAxesCombined },
      { title: "Demo Guide", href: "/demo-guide", icon: BookOpen },
      { title: "COA – Hệ thống & chỉ số", href: "/coa", icon: Compass },
      {
        title: "Khách hàng & Điều phối",
        href: "/khach-hang-dieu-phoi",
        icon: Users,
      },
    ],
  },
  {
    label: "Bán hàng",
    items: [
      {
        title: "CRM & Sales",
        href: "/crm",
        icon: Handshake,
        children: [
          { title: "Mess", href: "/crm/mess" },
          { title: "Khách hàng tiềm năng", href: "/crm/tiem-nang" },
          { title: "Lead", href: "/crm/leads" },
          { title: "Khách hàng", href: "/crm/khach-hang" },
          { title: "RFQ", href: "/crm/rfq" },
          { title: "Báo giá", href: "/crm/bao-gia" },
          { title: "Hợp đồng và cọc", href: "/crm/hop-dong" },
        ],
      },
    ],
  },
  {
    label: "Phòng ban",
    items: [
      {
        title: "Marketing",
        href: "/marketing",
        icon: Megaphone,
        children: [
          { title: "Tổng quan Marketing", href: "/marketing" },
          { title: "Chiến dịch", href: "/marketing/chien-dich" },
          { title: "Nguồn lead & chuyển đổi", href: "/marketing/hieu-qua-nguon" },
          { title: "Phản hồi từ Sales", href: "/marketing/phan-hoi" },
          { title: "Organic / Content", href: "/marketing/organic-content" },
          { title: "Ads & Performance", href: "/marketing/ads-performance" },
          { title: "SEO", href: "/marketing/seo" },
        ],
      },
      {
        title: "Sale Việt Nam",
        href: "/sale-viet-nam",
        icon: Briefcase,
        children: [
          { title: "Sales MKT Intern", href: "/sale-viet-nam/sales-mkt-intern" },
        ],
      },
      {
        title: "Sale Global",
        href: "/sale-global",
        icon: Globe2,
        children: [
          { title: "Sale Mỹ", href: "/sale-global/sale-my" },
        ],
      },
      {
        title: "Vận hành",
        href: "/van-hanh",
        icon: Truck,
        children: [
          { title: "Sourcing – Báo giá", href: "/van-hanh/sourcing-bao-gia" },
          { title: "Nhà cung cấp", href: "/van-hanh/nha-cung-cap" },
          { title: "Purchase Order", href: "/van-hanh/po" },
          { title: "Đơn hàng", href: "/van-hanh/don-hang" },
          { title: "Logistics – Lô hàng", href: "/van-hanh/logistics" },
          { title: "Chứng từ", href: "/van-hanh/chung-tu" },
        ],
      },
      {
        title: "Fulfillment",
        href: "/fulfillment",
        icon: Warehouse,
        children: [
          { title: "Tổng quan kho", href: "/fulfillment" },
          { title: "Nhập kho", href: "/fulfillment/nhap-kho" },
          { title: "Tồn kho", href: "/fulfillment/ton-kho" },
          { title: "Pick / Pack", href: "/fulfillment/pick-pack" },
          { title: "Giao hàng & POD", href: "/fulfillment/giao-hang" },
          { title: "Hỏi tình trạng đơn", href: "/fulfillment/hoi-tinh-trang" },
        ],
      },
      {
        title: "Kế toán",
        href: "/ke-toan",
        icon: Wallet,
        children: [
          { title: "Tài chính vận hành", href: "/ke-toan" },
          { title: "Cọc cần đối soát", href: "/ke-toan/doi-soat" },
          { title: "Đề nghị thanh toán", href: "/ke-toan/de-nghi-thanh-toan" },
          { title: "Duyệt thanh toán", href: "/ke-toan/duyet-thanh-toan" },
          { title: "Công nợ", href: "/ke-toan/cong-no" },
          { title: "Quyết toán hợp đồng", href: "/ke-toan/quyet-toan" },
          { title: "Thu chi & đối soát", href: "/ke-toan/thu-chi" },
          { title: "Lương & chi phí nội bộ", href: "/ke-toan/luong-chi-phi" },
        ],
      },
      {
        title: "Khiếu nại",
        href: "/khieu-nai",
        icon: FileCheck2,
      },
      {
        title: "HCNS",
        href: "/hcns",
        icon: UserCog,
        children: [
          { title: "Nhân viên", href: "/hcns/nhan-vien" },
          { title: "Cơ cấu tổ chức", href: "/hcns/co-cau" },
          { title: "Chấm công mock", href: "/hcns/cham-cong" },
          { title: "Tuyển dụng & nhân sự", href: "/hcns/tuyen-dung" },
          { title: "Hành chính & nhân sự", href: "/hcns/hanh-chinh" },
        ],
      },
      { title: "Pháp chế", href: "/phap-che", icon: FileCheck2, children: [
        { title: "Hồ sơ cần rà soát", href: "/phap-che" },
        { title: "Yêu cầu ý kiến pháp lý", href: "/phap-che/yeu-cau" },
      ] },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { title: "Cài đặt", href: "/cai-dat", icon: Settings2 },
    ],
  },
];

export interface Crumb {
  title: string;
  href: string;
}

/** Dựng breadcrumb từ pathname dựa trên cây navigation. */
export function getBreadcrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ title: "Trang chủ", href: "/dashboard" }];
  for (const group of navigation) {
    for (const item of group.items) {
      const child = item.children?.find((c) => c.href === pathname);
      if (child) {
        if (child.href !== item.href) crumbs.push({ title: item.title, href: item.href });
        crumbs.push(child);
        return crumbs;
      }
      // Trang chi tiết (ví dụ /crm/leads/MS-...) nằm dưới một mục con
      const parent = item.children?.filter((c) => pathname.startsWith(`${c.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
      if (parent) {
        if (parent.href !== item.href) crumbs.push({ title: item.title, href: item.href });
        crumbs.push(parent, { title: "Chi tiết", href: pathname });
        return crumbs;
      }
      if (item.href === pathname || (!item.children && pathname.startsWith(`${item.href}/`))) {
        if (pathname !== "/dashboard") crumbs.push({ title: item.title, href: item.href });
        if (item.href !== pathname) crumbs.push({ title: "Chi tiết", href: pathname });
        return crumbs;
      }
    }
  }
  return crumbs;
}

/** Mọi href trong navigation (dùng cho generateStaticParams). */
export const allHrefs: string[] = navigation.flatMap((g) =>
  g.items.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])]),
);

/** Tên trang theo pathname (null nếu không thuộc navigation). */
export function findTitle(pathname: string): string | null {
  const last = getBreadcrumbs(pathname).at(-1);
  return last && (last.href === pathname || pathname === "/dashboard") ? last.title : null;
}
