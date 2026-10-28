"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { milestones, modeLabels, shipmentStatusMeta } from "@/config/operations";
import { usePagination } from "@/features/crm/hooks";
import { formatDate } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import { delayDays, doneCount, shipmentStatus } from "@/services/ops/rules";
import type { TransportMode } from "@/types/crm";
import type { Shipment, ShipmentStatus } from "@/types/ops";
import { useOps } from "../hooks";
import { ShipmentBadge } from "./ops-badges";

export function ShipmentsView() {
  const { ops, crm, today } = useOps();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<TransportMode | "">("");
  const [status, setStatus] = useState<ShipmentStatus | "">("");
  const [partner, setPartner] = useState("");
  const [onlyDelayed, setOnlyDelayed] = useState(false);

  const partnerName = new Map(ops.partners.map((p) => [p.partnerId, p.name]));
  const customerOf = useMemo(() => new Map(crm.contracts.map((c) => [c.orderId, crm.customers.find((x) => x.customerId === c.customerId)?.name ?? c.customerId])), [crm]);
  const delayedCount = ops.shipments.filter((s) => delayDays(s, today) > 0).length;

  const filtered = useMemo(
    () =>
      [...ops.shipments]
        .sort((a, b) => delayDays(b, today) - delayDays(a, today) || b.shipmentId.localeCompare(a.shipmentId))
        .filter(
          (s) =>
            (!mode || s.mode === mode) &&
            (!status || shipmentStatus(s) === status) &&
            (!partner || s.partnerId === partner) &&
            (!onlyDelayed || delayDays(s, today) > 0) &&
            matchesQuery(query, s.shipmentId, s.orderId, s.destination, s.originPoint, customerOf.get(s.orderId)),
        ),
    [ops.shipments, mode, status, partner, onlyDelayed, query, today, customerOf],
  );
  const paging = usePagination(filtered, 15);

  const columns: Column<Shipment>[] = [
    { key: "id", header: "Lô hàng", cell: (s) => <Link href={`/van-hanh/logistics/${s.shipmentId}`} className="font-mono text-xs font-medium text-primary hover:underline">{s.shipmentId}</Link> },
    {
      key: "order",
      header: "Đơn / khách",
      cell: (s) => (
        <div className="min-w-0">
          <Link href={`/van-hanh/don-hang/${s.orderId}`} className="font-mono text-xs hover:text-primary hover:underline">{s.orderId}</Link>
          <p className="max-w-48 truncate text-xs text-muted-foreground">{customerOf.get(s.orderId)}</p>
        </div>
      ),
    },
    { key: "mode", header: "Loại hình", cell: (s) => modeLabels[s.mode] },
    { key: "route", header: "Tuyến", cell: (s) => <span className="block max-w-56 truncate text-xs text-muted-foreground">{s.originPoint} → {s.destination}</span>, className: "hidden 2xl:table-cell" },
    { key: "partner", header: "Đối tác", cell: (s) => <span className="block max-w-44 truncate text-xs">{partnerName.get(s.partnerId)}</span>, className: "hidden lg:table-cell" },
    { key: "status", header: "Trạng thái", cell: (s) => <ShipmentBadge value={shipmentStatus(s)} /> },
    { key: "progress", header: "Mốc", align: "right", cell: (s) => `${doneCount(s)}/${milestones.length}`, className: "hidden md:table-cell" },
    { key: "eta", header: "ETA", cell: (s) => <span className="tabular text-muted-foreground">{formatDate(s.eta)}</span>, className: "hidden md:table-cell" },
    {
      key: "delay",
      header: "Tiến độ",
      cell: (s) => {
        const d = delayDays(s, today);
        return d > 0 ? <StatusBadge tone="danger">Chậm {d} ngày</StatusBadge> : <span className="text-xs text-muted-foreground">Đúng tiến độ</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader title="Logistics – Lô hàng" description={`Lô hàng air/sea, LCL/FCL. ${delayedCount} lô đang chậm tiến độ. Tracking là dữ liệu demo hoặc nhập tay, không theo dõi thời gian thực.`} />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm lô hàng" placeholder="Tìm mã lô, order_id, điểm đi/đến, khách…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        <NativeSelect aria-label="Lọc loại hình" className="w-44" value={mode} onChange={(e) => setMode(e.target.value as TransportMode | "")}>
          <option value="">Mọi loại hình</option>
          {(Object.keys(modeLabels) as TransportMode[]).map((m) => <option key={m} value={m}>{modeLabels[m]}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Lọc trạng thái" className="w-52" value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus | "")}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(shipmentStatusMeta) as ShipmentStatus[]).map((s) => <option key={s} value={s}>{shipmentStatusMeta[s].label}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Lọc đối tác vận chuyển" className="w-52" value={partner} onChange={(e) => setPartner(e.target.value)}>
          <option value="">Mọi đối tác</option>
          {ops.partners.map((p) => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--brand-navy)]" checked={onlyDelayed} onChange={(e) => setOnlyDelayed(e.target.checked)} />
          Chỉ lô chậm tiến độ ({delayedCount})
        </label>
      </div>
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={(s) => s.shipmentId} empty={<EmptyState title="Không có lô hàng phù hợp" />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}
