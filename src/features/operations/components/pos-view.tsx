"use client";

import { useListTools } from "@/components/shared/list-tools";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { poFlow, poStatusMeta } from "@/config/operations";
import { usePagination } from "@/features/crm/hooks";
import { formatDate, formatVnd } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import type { PoStatus, PurchaseOrder } from "@/types/ops";
import { useOps } from "../hooks";
import { PoBadge } from "./ops-badges";

export function PoProgress({ status }: { status: PoStatus }) {
  const idx = poFlow.indexOf(status);
  const pct = idx < 0 ? 0 : (idx / (poFlow.length - 1)) * 100;
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Tiến độ PO">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      <span className="tabular text-xs text-muted-foreground">{Math.round(pct)}%</span>
    </div>
  );
}

export function PosView() {
  const { ops, crm, staffName } = useOps();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PoStatus | "">("");
  const [supplier, setSupplier] = useState("");
  const supplierName = new Map(ops.suppliers.map((s) => [s.supplierId, s.name]));
  const customerOf = new Map(crm.contracts.map((c) => [c.orderId, c.customerId]));
  const customerName = new Map(crm.customers.map((c) => [c.customerId, c.name]));

  const filtered = [...ops.pos]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.poId.localeCompare(a.poId))
    .filter((p) => (!status || p.status === status) && (!supplier || p.supplierId === supplier) && matchesQuery(query, p.poId, p.orderId, supplierName.get(p.supplierId)));
  const listTools = useListTools(filtered, { filename: "speego-pos.csv", name: (r) => r.supplierId, date: (r) => r.createdAt, dateLabel: "Ngày tạo", columns: [{ label: "Mã", value: (r) => r.poId }, { label: "Tên / nội dung", value: (r) => r.supplierId }, { label: "Ngày tạo", value: (r) => r.createdAt }, { label: "order_id", value: (r) => r.orderId }, { label: "amount_vnd", value: (r) => r.amount }, { label: "status", value: (r) => r.status }] });
  const paging = usePagination(listTools.rows, 15, listTools.resetKey);

  const columns: Column<PurchaseOrder>[] = [
    { key: "po", header: "PO", cell: (p) => <Link href={`/van-hanh/po/${p.poId}`} className="font-mono text-xs font-medium text-primary hover:underline">{p.poId}</Link> },
    {
      key: "order",
      header: "Đơn hàng",
      cell: (p) => (
        <div className="min-w-0">
          <Link href={`/van-hanh/don-hang/${p.orderId}`} className="font-mono text-xs hover:text-primary hover:underline">{p.orderId}</Link>
          <p className="max-w-48 truncate text-xs text-muted-foreground">{customerName.get(customerOf.get(p.orderId) ?? "")}</p>
        </div>
      ),
    },
    { key: "sup", header: "Nhà cung cấp", cell: (p) => <Link href={`/van-hanh/nha-cung-cap/${p.supplierId}`} className="hover:underline">{supplierName.get(p.supplierId)}</Link>, className: "hidden lg:table-cell" },
    { key: "amt", header: "Giá trị", align: "right", cell: (p) => formatVnd(p.amount) },
    { key: "status", header: "Trạng thái", cell: (p) => <PoBadge value={p.status} /> },
    { key: "prog", header: "Tiến độ", cell: (p) => <PoProgress status={p.status} />, className: "hidden md:table-cell" },
    { key: "ready", header: "Dự kiến sẵn sàng", cell: (p) => <span className="tabular text-muted-foreground">{formatDate(p.expectedReadyOn)}</span>, className: "hidden xl:table-cell" },
    { key: "who", header: "Phụ trách", cell: (p) => staffName(p.assigneeId), className: "hidden xl:table-cell" },
  ];

  return (
    <>
      <PageHeader title="Đơn mua xưởng" description="PO đặt xưởng và tiến độ. Chỉ đặt xưởng được khi Kế toán đã xác nhận Đã cọc; PO tạo từ chi tiết hợp đồng." />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm PO" placeholder="Tìm mã PO, order_id, nhà cung cấp…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        <NativeSelect aria-label="Lọc trạng thái PO" className="w-48" value={status} onChange={(e) => setStatus(e.target.value as PoStatus | "")}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(poStatusMeta) as PoStatus[]).map((s) => <option key={s} value={s}>{poStatusMeta[s].label}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Lọc nhà cung cấp" className="w-52" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
          <option value="">Mọi nhà cung cấp</option>
          {ops.suppliers.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.name}</option>)}
        </NativeSelect>
      </div>
      {listTools.toolbar}
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={(p) => p.poId} empty={<EmptyState title="Không có PO phù hợp" />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}
