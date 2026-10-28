import { CheckCircle2 } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { departmentLabels } from "@/config/departments";
import { formatVndCompact } from "@/lib/format";
import { attentionLabels, routeLabels } from "./labels";
import type { DashboardMetrics } from "./metrics";

type Row = DashboardMetrics["attentionOrders"][number];

const columns: Column<Row>[] = [
  {
    key: "order",
    header: "Đơn hàng",
    cell: ({ order, customer }) => (
      <div className="min-w-0">
        <p className="font-medium">{order.id}</p>
        <p className="max-w-56 truncate text-xs text-muted-foreground">
          {customer} · {routeLabels[order.route]}
        </p>
      </div>
    ),
  },
  {
    key: "issue",
    header: "Vấn đề",
    cell: ({ order }) => {
      const a = attentionLabels[order.attention!];
      return <StatusBadge tone={a.tone}>{a.label}</StatusBadge>;
    },
  },
  { key: "dept", header: "Đang ở", cell: ({ order }) => departmentLabels[order.department], className: "hidden md:table-cell" },
  { key: "value", header: "Giá trị", align: "right", cell: ({ order }) => formatVndCompact(order.contractValue) },
];

export function AttentionOrders({ rows, total }: { rows: Row[]; total: number }) {
  return (
    <SectionCard
      title="Đơn hàng cần chú ý"
      description={total > 0 ? `${total} đơn có vấn đề, hiển thị ${rows.length} đơn nghiêm trọng nhất` : undefined}
      className="lg:col-span-3"
      bodyClassName="p-0 pt-3"
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.order.id}
        className="rounded-none border-x-0 border-b-0 shadow-none"
        empty={<EmptyState icon={CheckCircle2} title="Không có đơn cần chú ý" description="Các đơn hàng đang đúng tiến độ." className="py-8" />}
      />
    </SectionCard>
  );
}
