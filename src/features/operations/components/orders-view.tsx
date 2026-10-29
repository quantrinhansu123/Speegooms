"use client";

import { useListTools } from "@/components/shared/list-tools";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { routeLabels } from "@/config/crm";
import { usePagination } from "@/features/crm/hooks";
import { formatDate, formatMoney } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import { cn } from "@/lib/utils";
import { orderStages, type OrderStage, type OrderView } from "@/services/ops/rules";
import { useOps } from "../hooks";
import { StageBadge } from "./ops-badges";

export function OrdersView() {
  const { orders, ops, crm, staffName } = useOps();
  const [query, setQuery] = useState("");
  const [route, setRoute] = useState("");
  const [stage, setStage] = useState<OrderStage | "">("");
  const [person, setPerson] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const people = useMemo(
    () => [...crm.staff.filter((s) => s.team === "sale-vn" || s.team === "sale-global"), ...ops.staff].map((s) => ({ id: s.id, name: s.name })),
    [crm.staff, ops.staff],
  );

  const filtered = useMemo(
    () =>
      [...orders]
        .sort((a, b) => b.contract.createdAt.localeCompare(a.contract.createdAt) || b.contract.orderId.localeCompare(a.contract.orderId))
        .filter(
          (o) =>
            (!route || o.contract.route === route) &&
            (!stage || o.stage === stage) &&
            (!person || o.contract.ownerId === person || o.state.assigneeId === person) &&
            (!onlyAlerts || o.alerts.length > 0) &&
            matchesQuery(query, o.contract.orderId, o.contract.contractNo, o.contract.rfqId, o.customer?.name),
        ),
    [orders, route, stage, person, onlyAlerts, query],
  );
  const listTools = useListTools(filtered, { filename: "speego-orders.csv", name: (r) => r.customer?.name ?? r.contract.orderId, date: (r) => r.contract.createdAt, dateLabel: "Ngày tạo", columns: [{ label: "Mã", value: (r) => r.contract.orderId }, { label: "Tên / nội dung", value: (r) => r.customer?.name ?? r.contract.orderId }, { label: "Ngày tạo", value: (r) => r.contract.createdAt }, { label: "route", value: (r) => r.contract.route }, { label: "stage", value: (r) => r.stage }, { label: "due_on", value: (r) => r.state.dueOn }] });
  const paging = usePagination(listTools.rows, 15, listTools.resetKey);
  const alertCount = orders.filter((o) => o.alerts.length > 0).length;

  const columns: Column<OrderView>[] = [
    { key: "id", header: "Hợp đồng", cell: (o) => <Link href={`/van-hanh/don-hang/${o.contract.orderId}`} className="font-mono text-xs font-medium text-primary hover:underline">{o.contract.contractNo}</Link> },
    {
      key: "customer",
      header: "Khách hàng",
      cell: (o) => (
        <div className="min-w-0">
          <p className="max-w-52 truncate font-medium">{o.customer?.name ?? o.contract.customerId}</p>
          <p className="font-mono text-xs text-muted-foreground">{o.contract.rfqId}</p>
        </div>
      ),
    },
    { key: "route", header: "Tuyến", cell: (o) => routeLabels[o.contract.route], className: "hidden lg:table-cell" },
    { key: "stage", header: "Giai đoạn", cell: (o) => <StageBadge value={o.stage} /> },
    {
      key: "people",
      header: "Phụ trách",
      className: "hidden xl:table-cell",
      cell: (o) => (
        <div className="text-xs">
          <p>VH: {staffName(o.state.assigneeId)}</p>
          <p className="text-muted-foreground">Sale: {staffName(o.contract.ownerId)}</p>
        </div>
      ),
    },
    { key: "value", header: "Giá trị", align: "right", cell: (o) => formatMoney(o.contract.value, o.contract.currency), className: "hidden md:table-cell" },
    {
      key: "due",
      header: "Hạn giao",
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
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm đơn hàng" placeholder="Tìm order_id, số hợp đồng, rfq_id, khách…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        <NativeSelect aria-label="Lọc theo tuyến Sale" className="w-44" value={route} onChange={(e) => setRoute(e.target.value)}>
          <option value="">Sale VN và Global</option>
          <option value="vn">Sale Việt Nam</option>
          <option value="global">Sale Global</option>
        </NativeSelect>
        <NativeSelect aria-label="Lọc giai đoạn" className="w-56" value={stage} onChange={(e) => setStage(e.target.value as OrderStage | "")}>
          <option value="">Mọi giai đoạn</option>
          {orderStages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Lọc nhân viên" className="w-48" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Mọi nhân viên</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--brand-navy)]" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} />
          Chỉ đơn có cảnh báo
        </label>
      </div>
      {listTools.toolbar}
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={(o) => o.contract.orderId} empty={<EmptyState title="Không có đơn phù hợp" />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}
