"use client";

import { ListView } from "@/components/shared/list-view";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { routeLabels } from "@/config/crm";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { orderStages, type OrderView } from "@/services/ops/rules";
import { useOps } from "../hooks";
import { StageBadge } from "./ops-badges";

export function OrdersView() {
  const { orders, ops, crm, staffName } = useOps();
  const people = [...new Map([...crm.staff.filter((person) => person.team === "sale-vn" || person.team === "sale-global"), ...ops.staff].map((person) => [person.id, person])).values()];
  const alertCount = orders.filter((o) => o.alerts.length > 0).length;

  const columns: Column<OrderView>[] = [
    { key: "id", header: "Hợp đồng", sortValue: (o) => o.contract.contractNo, exportValue: (o) => `${o.contract.contractNo} · ${o.contract.orderId}`, cell: (o) => <Link href={`/van-hanh/don-hang/${o.contract.orderId}`} className="font-mono text-xs font-medium text-primary hover:underline">{o.contract.contractNo}</Link> },
    {
      key: "customer",
      header: "Khách hàng",
      exportValue: (o) => o.customer?.name ?? o.contract.customerId,
      cell: (o) => (
        <div className="min-w-0">
          <p className="max-w-52 truncate font-medium">{o.customer?.name ?? o.contract.customerId}</p>
          <p className="font-mono text-xs text-muted-foreground">{o.contract.rfqId}</p>
        </div>
      ),
    },
    { key: "route", header: "Tuyến", exportValue: (o) => routeLabels[o.contract.route], cell: (o) => routeLabels[o.contract.route] },
    { key: "stage", header: "Giai đoạn", exportValue: (o) => orderStages.find((stage) => stage.key === o.stage)?.label ?? o.stage, cell: (o) => <StageBadge value={o.stage} /> },
    {
      key: "people",
      header: "Phụ trách",
      exportValue: (o) => `VH: ${staffName(o.state.assigneeId)} · Sale: ${staffName(o.contract.ownerId)}`,
      cell: (o) => (
        <div className="text-xs">
          <p>VH: {staffName(o.state.assigneeId)}</p>
          <p className="text-muted-foreground">Sale: {staffName(o.contract.ownerId)}</p>
        </div>
      ),
    },
    { key: "value", header: "Giá trị", sortValue: (o) => o.contract.value, exportValue: (o) => formatMoney(o.contract.value, o.contract.currency), align: "right", cell: (o) => formatMoney(o.contract.value, o.contract.currency) },
    {
      key: "due",
      header: "Hạn giao",
      exportValue: (o) => o.state.dueOn,
      cell: (o) => (
        <span className={cn("tabular", o.daysOverdue > 0 ? "font-medium text-danger" : "text-muted-foreground")}>
          {o.state.dueOn ? formatDate(o.state.dueOn) : "—"}
          {o.daysOverdue > 0 && <span className="block text-xs">Quá {o.daysOverdue} ngày</span>}
        </span>
      ),
    },
    {
      key: "alerts",
      header: "Cảnh báo",
      exportValue: (o) => o.alerts.map((alert) => alert.text).join("; "),
      cell: (o) =>
        o.alerts.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", o.alerts.some((a) => a.level === "danger") ? "text-danger" : "text-warning")} title={o.alerts.map((a) => a.text).join("; ")}>
            <AlertTriangle aria-hidden className="size-3.5" />
            {o.alerts.length} cảnh báo
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Hợp đồng" description={`Theo dõi vận hành các hợp đồng đã ký của Sale. ${alertCount} hợp đồng đang có cảnh báo.`} />
      <ListView<OrderView>
        rows={orders}
        columns={columns}
        getRowId={(order) => order.contract.orderId}
        searchLabel="Tìm hợp đồng"
        searchPlaceholder="Số hợp đồng, mã đơn, RFQ, tên khách hàng…"
        searchText={(order) => [order.contract.orderId, order.contract.contractNo, order.contract.rfqId, order.customer?.name]}
        dateValue={(order) => order.contract.createdAt}
        dateLabel="Ngày tạo hợp đồng"
        exportFilename="speego-orders.csv"
        filters={[
          { id: "route", label: "Tuyến Sale", options: Object.entries(routeLabels).map(([value, label]) => ({ value, label })), match: (order, value) => order.contract.route === value },
          { id: "stage", label: "Giai đoạn vận hành", options: orderStages.map((stage) => ({ value: stage.key, label: stage.label })), match: (order, value) => order.stage === value },
          { id: "person", label: "Nhân viên phụ trách", options: people.map((person) => ({ value: person.id, label: person.name })), match: (order, value) => order.contract.ownerId === value || order.state.assigneeId === value },
          { id: "deadline", label: "Hạn giao", options: [{ value: "overdue", label: "Đã quá hạn" }, { value: "unset", label: "Chưa có hạn giao" }], match: (order, value) => value === "overdue" ? order.daysOverdue > 0 : !order.state.dueOn },
        ]}
        toggles={[{ id: "alerts", label: "Chỉ hợp đồng có cảnh báo", match: (order) => order.alerts.length > 0 }]}
        sort={(a, b) => b.contract.createdAt.localeCompare(a.contract.createdAt)}
      />
    </>
  );
}
