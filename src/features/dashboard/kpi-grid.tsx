import { BadgeDollarSign, Clock, FileText, Package, UserPlus, Wallet, type LucideIcon } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { isImplemented } from "@/config/modules";
import { canAccess } from "@/config/roles";
import { formatNumber, formatVndCompact } from "@/lib/format";
import type { Role } from "@/types/role";
import type { DashboardMetrics } from "./metrics";

interface KpiDef {
  key: keyof DashboardMetrics["kpis"];
  label: string;
  icon: LucideIcon;
  /** Trang danh sách tương ứng; chỉ thành link khi module tồn tại và vai trò có quyền */
  href: string;
  money?: boolean;
  caption?: string;
}

const defs: KpiDef[] = [
  { key: "newLeads", label: "Lead mới", icon: UserPlus, href: "/crm/leads" },
  { key: "rfqProcessing", label: "RFQ đang xử lý", icon: FileText, href: "/crm/rfq", caption: "Tại thời điểm hiện tại" },
  { key: "ordersActive", label: "Đơn hàng đang thực hiện", icon: Package, href: "/van-hanh/don-hang", caption: "Tại thời điểm hiện tại" },
  { key: "ordersPendingDeposit", label: "Đơn chờ xác nhận cọc", icon: Clock, href: "/ke-toan/doi-soat", caption: "Chờ Kế toán xác nhận" },
  { key: "contractValue", label: "Tổng giá trị hợp đồng", icon: BadgeDollarSign, href: "/crm/hop-dong", money: true },
  { key: "receivable", label: "Công nợ cần thu", icon: Wallet, href: "/ke-toan/cong-no", money: true, caption: "Đơn đang thực hiện và hoàn tất" },
];

export function KpiGrid({ kpis, role }: { kpis: DashboardMetrics["kpis"]; role: Role }) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {defs.map((d) => {
        const kpi = kpis[d.key];
        return (
          <StatCard
            key={d.key}
            label={d.label}
            icon={d.icon}
            value={d.money ? formatVndCompact(kpi.value) : formatNumber(kpi.value)}
            delta={kpi.delta}
            deltaLabel="so với kỳ trước"
            caption={d.caption ?? "Chưa có kỳ trước để so sánh"}
            href={isImplemented(d.href) && canAccess(role, d.href) ? d.href : undefined}
          />
        );
      })}
    </div>
  );
}
