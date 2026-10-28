"use client";

import { Boxes, Package as PackageIcon, Weight } from "lucide-react";
import Link from "next/link";
import type { Column } from "@/components/shared/data-table";
import { ListView } from "@/components/shared/list-view";
import { StatCard } from "@/components/shared/stat-card";
import { packageStatusMeta } from "@/config/fulfillment";
import { formatNumber } from "@/lib/format";
import { isInStock } from "@/services/fulfillment/rules";
import type { Package, PackageStatus } from "@/types/fulfillment";
import { useFulfillment } from "../hooks";
import { PackageBadge } from "./fulfillment-badges";

export function InventoryView() {
  const { wh } = useFulfillment();
  const whName = new Map(wh.warehouses.map((w) => [w.warehouseId, w.name]));
  const stock = wh.packages.filter(isInStock);

  const columns: Column<Package>[] = [
    { key: "id", header: "Mã kiện", cell: (p) => <Link href={`/fulfillment/ton-kho/${p.packageId}`} className="font-mono text-xs font-medium text-primary hover:underline">{p.packageId}</Link> },
    { key: "sku", header: "SKU", cell: (p) => <div><p className="font-mono text-xs">{p.sku}</p><p className="max-w-44 truncate text-xs text-muted-foreground">{p.description}</p></div> },
    { key: "qty", header: "Số lượng", align: "right", cell: (p) => formatNumber(p.quantity) },
    { key: "kg", header: "Kg", align: "right", cell: (p) => formatNumber(p.weightKg), className: "hidden md:table-cell" },
    { key: "loc", header: "Vị trí", cell: (p) => <span className="font-mono text-xs">{p.location}</span> },
    { key: "wh", header: "Kho", cell: (p) => <span className="text-xs">{whName.get(p.warehouseId)}</span>, className: "hidden xl:table-cell" },
    { key: "order", header: "Đơn hàng", cell: (p) => <Link href={`/van-hanh/don-hang/${p.orderId}`} className="font-mono text-xs text-muted-foreground hover:underline">{p.orderId}</Link>, className: "hidden lg:table-cell" },
    { key: "status", header: "Trạng thái", cell: (p) => <PackageBadge value={p.status} /> },
  ];

  return (
    <ListView
      title="Tồn kho"
      description="Kiện hàng và vị trí lưu kho. Tìm theo SKU hoặc mã kiện. Mặc định chỉ hiện kiện còn trong kho."
      summary={
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <StatCard label="Kiện trong kho" icon={PackageIcon} value={formatNumber(stock.length)} />
          <StatCard label="Tổng số lượng" icon={Boxes} value={formatNumber(stock.reduce((a, p) => a + p.quantity, 0))} />
          <StatCard label="Tổng trọng lượng (kg)" icon={Weight} value={formatNumber(stock.reduce((a, p) => a + p.weightKg, 0))} />
        </div>
      }
      columns={columns}
      rows={wh.packages}
      getRowId={(p) => p.packageId}
      searchLabel="Tìm SKU hoặc mã kiện"
      searchPlaceholder="Tìm SKU, mã kiện, vị trí, đơn hàng…"
      searchText={(p) => [p.sku, p.packageId, p.location, p.orderId, p.description]}
      filters={[
        { id: "status", label: "Mọi trạng thái", options: (Object.keys(packageStatusMeta) as PackageStatus[]).map((s) => ({ value: s, label: packageStatusMeta[s].label })), match: (p, v) => p.status === v },
        { id: "wh", label: "Mọi kho", options: wh.warehouses.map((w) => ({ value: w.warehouseId, label: w.name })), match: (p, v) => p.warehouseId === v, className: "w-56" },
      ]}
      toggles={[{ id: "stock", label: "Chỉ kiện còn trong kho", match: isInStock, initial: true }]}
      sort={(a, b) => b.packageId.localeCompare(a.packageId)}
      emptyTitle="Không có kiện phù hợp"
    />
  );
}
