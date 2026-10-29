"use client";

import Link from "next/link";
import type { Column } from "@/components/shared/data-table";
import { ListView } from "@/components/shared/list-view";
import { StatusBadge } from "@/components/shared/status-badge";
import { routeLabels, transportLabels } from "@/config/crm";
import { formatDate } from "@/lib/format";
import type { Rfq } from "@/types/crm";
import { useOps } from "../hooks";

export function LogisticsQuotesView() {
  const { crm, staffName } = useOps();
  const rows = crm.rfqs.filter((r) => r.priceRequest.logistics !== "chua-gui");
  const customerName = new Map(crm.customers.map((c) => [c.customerId, c.name]));
  const columns: Column<Rfq>[] = [
    { key: "id", header: "RFQ", cell: (r) => <Link href={`/crm/rfq/${r.rfqId}`} className="font-mono text-xs font-medium text-primary hover:underline">{r.rfqId}</Link> },
    { key: "goods", header: "Hàng hóa / khách", cell: (r) => <div><p className="font-medium">{r.goodsName}</p><p className="text-xs text-muted-foreground">{customerName.get(r.customerId) ?? r.customerId}</p></div> },
    { key: "route", header: "Tuyến", cell: (r) => routeLabels[r.route] },
    { key: "origin", header: "Điểm đi", cell: (r) => r.originPoint },
    { key: "destination", header: "Điểm đến", cell: (r) => r.destination },
    { key: "mode", header: "Vận chuyển", cell: (r) => transportLabels[r.transportMode] },
    { key: "status", header: "Trạng thái giá cước", cell: (r) => <StatusBadge tone={r.priceRequest.logistics === "da-co-gia" ? "success" : "warning"}>{r.priceRequest.logistics === "da-co-gia" ? "Đã có giá" : "Đang chờ giá"}</StatusBadge> },
    { key: "owner", header: "Sale phụ trách", cell: (r) => staffName(r.ownerId) },
    { key: "date", header: "Ngày gửi", cell: (r) => r.priceRequest.sentAt ? formatDate(r.priceRequest.sentAt) : "—" },
  ];

  return <ListView<Rfq>
    title="Logistics – Báo giá"
    description="Yêu cầu giá cước từ RFQ đã gửi Logistics. Mở RFQ để xem chi tiết yêu cầu."
    rows={rows}
    columns={columns}
    getRowId={(r) => r.rfqId}
    searchLabel="Tìm yêu cầu giá cước"
    searchPlaceholder="Mã RFQ, hàng hóa, khách, điểm đi, điểm đến…"
    searchText={(r) => [r.rfqId, r.goodsName, customerName.get(r.customerId), r.originPoint, r.destination]}
    dateValue={(r) => r.priceRequest.sentAt ?? r.createdAt}
    dateLabel="Ngày gửi"
    exportFilename="speego-logistics-bao-gia.csv"
    filters={[
      { id: "status", label: "Mọi trạng thái", options: [{ value: "cho-gia", label: "Đang chờ giá" }, { value: "da-co-gia", label: "Đã có giá" }], match: (r, v) => r.priceRequest.logistics === v },
      { id: "route", label: "Cả hai tuyến", options: Object.entries(routeLabels).map(([value, label]) => ({ value, label })), match: (r, v) => r.route === v },
    ]}
    sort={(a, b) => (b.priceRequest.sentAt ?? b.createdAt).localeCompare(a.priceRequest.sentAt ?? a.createdAt)}
  />;
}
