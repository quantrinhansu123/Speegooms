"use client";

import { useListTools } from "@/components/shared/list-tools";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rfqStatusMeta, routeLabels, transportLabels } from "@/config/crm";
import { formatDate } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import type { Rfq, RfqStatus, RouteCode } from "@/types/crm";
import { useCrm, usePagination } from "../hooks";
import { RfqBadge } from "./meta-badges";
import { RfqCreateDialog } from "./rfq-create-dialog";

export function RfqsView({ routeScope }: { routeScope?: RouteCode } = {}) {
  const { data, all, can, scope } = useCrm(routeScope);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RfqStatus | "">("");
  const [route, setRoute] = useState("");
  const [creating, setCreating] = useState(false);

  const customerName = new Map(all.customers.map((c) => [c.customerId, c.name]));
  const filtered = data.rfqs.filter(
    (r) =>
      (!status || r.status === status) &&
      (!route || r.route === route) &&
      matchesQuery(query, r.rfqId, r.messId, r.goodsName, customerName.get(r.customerId)),
  );
  const listTools = useListTools(filtered, { filename: "speego-rfqs.csv", name: (r) => r.goodsName, date: (r) => r.createdAt, dateLabel: "Ngày tạo", columns: [{ label: "Mã", value: (r) => r.rfqId }, { label: "Tên / nội dung", value: (r) => r.goodsName }, { label: "Ngày tạo", value: (r) => r.createdAt }, { label: "route", value: (r) => r.route }, { label: "status", value: (r) => r.status }, { label: "quantity", value: (r) => r.quantity }] });
  const paging = usePagination(listTools.rows, 15, listTools.resetKey);

  const columns: Column<Rfq>[] = [
    { key: "id", header: "rfq_id", cell: (r) => <Link href={`/crm/rfq/${r.rfqId}`} className="font-mono text-xs font-medium text-primary hover:underline">{r.rfqId}</Link> },
    {
      key: "customer",
      header: "Khách hàng",
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/crm/khach-hang/${r.customerId}`} className="font-medium hover:text-primary hover:underline">
            {customerName.get(r.customerId) ?? r.customerId}
          </Link>
          <p className="max-w-56 truncate text-xs text-muted-foreground">{r.goodsName}</p>
        </div>
      ),
    },
    { key: "qty", header: "Số lượng", align: "right", cell: (r) => `${r.quantity.toLocaleString("vi-VN")} ${r.unit}`, className: "hidden md:table-cell" },
    { key: "mode", header: "Vận chuyển", cell: (r) => transportLabels[r.transportMode], className: "hidden xl:table-cell" },
    { key: "route", header: "Tuyến", cell: (r) => routeLabels[r.route], className: "hidden lg:table-cell" },
    { key: "status", header: "Trạng thái", cell: (r) => <RfqBadge value={r.status} /> },
    { key: "date", header: "Ngày tạo", cell: (r) => <span className="tabular text-muted-foreground">{formatDate(r.createdAt)}</span>, className: "hidden md:table-cell" },
  ];

  return (
    <>
      <PageHeader
        title="Yêu cầu báo giá (RFQ)"
        description="RFQ tạo từ lead Hot, giữ mess_id và customer_id. Bàn giao yêu cầu giá cho Sourcing và Logistics."
        actions={
          can("rfq.write") && (
            <Button size="lg" onClick={() => setCreating(true)}>
              <Plus /> Tạo RFQ từ lead
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm RFQ" placeholder="Tìm rfq_id, mess_id, hàng hóa, khách…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 pl-8" />
        </div>
        <NativeSelect aria-label="Lọc trạng thái RFQ" className="w-48" value={status} onChange={(e) => setStatus(e.target.value as RfqStatus | "")}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(rfqStatusMeta) as RfqStatus[]).map((s) => (
            <option key={s} value={s}>
              {rfqStatusMeta[s].label}
            </option>
          ))}
        </NativeSelect>
        {!scope && (
          <NativeSelect aria-label="Lọc tuyến" className="w-44" value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="">Cả hai tuyến</option>
            <option value="vn">Sale Việt Nam</option>
            <option value="global">Sale Global</option>
          </NativeSelect>
        )}
      </div>
      {listTools.toolbar}
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={(r) => r.rfqId} empty={<EmptyState title="Không có RFQ phù hợp" />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
      {creating && <RfqCreateDialog routeScope={routeScope} open onOpenChange={(o) => !o && setCreating(false)} onCreated={(id) => router.push(`/crm/rfq/${id}`)} />}
    </>
  );
}
