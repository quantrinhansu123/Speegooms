"use client";

import Link from "next/link";
import type { Column } from "@/components/shared/data-table";
import { ListView } from "@/components/shared/list-view";
import { deliveryStatusMeta } from "@/config/fulfillment";
import { formatDate } from "@/lib/format";
import type { Delivery, DeliveryStatus } from "@/types/fulfillment";
import { useFulfillment } from "../hooks";
import { DeliveryBadge } from "./fulfillment-badges";

export function DeliveriesView() {
  const { wh, crm } = useFulfillment();
  const customerOf = new Map(crm.contracts.map((c) => [c.orderId, crm.customers.find((x) => x.customerId === c.customerId)?.name ?? c.customerId]));

  const columns: Column<Delivery>[] = [
    { key: "id", header: "Lần giao", cell: (d) => <Link href={`/fulfillment/giao-hang/${d.deliveryId}`} className="font-mono text-xs font-medium text-primary hover:underline">{d.deliveryId}</Link> },
    {
      key: "order",
      header: "Đơn / người nhận",
      cell: (d) => (
        <div className="min-w-0">
          <Link href={`/van-hanh/don-hang/${d.orderId}`} className="font-mono text-xs hover:text-primary hover:underline">{d.orderId}</Link>
          <p className="max-w-48 truncate text-xs text-muted-foreground">{customerOf.get(d.orderId)} · {d.recipientName}</p>
        </div>
      ),
    },
    { key: "carrier", header: "Đơn vị giao", cell: (d) => <span className="block max-w-44 truncate text-xs">{d.carrier}</span>, className: "hidden lg:table-cell" },
    { key: "addr", header: "Giao đến", cell: (d) => <span className="block max-w-52 truncate text-xs text-muted-foreground">{d.address}</span>, className: "hidden xl:table-cell" },
    { key: "date", header: "Xuất giao", cell: (d) => <span className="tabular text-muted-foreground">{formatDate(d.dispatchedAt)}</span>, className: "hidden md:table-cell" },
    { key: "status", header: "Trạng thái", cell: (d) => <DeliveryBadge value={d.status} /> },
    { key: "pod", header: "POD", cell: (d) => (d.pod ? <span className="text-xs">{d.pod.receivedBy} · {formatDate(d.pod.signedOn)}</span> : <span className="text-xs text-muted-foreground">Chưa có</span>), className: "hidden md:table-cell" },
  ];

  return (
    <ListView dateLabel="Ngày xuất giao" dateValue={(r) => r.dispatchedAt}
      title="Giao hàng chặng cuối và POD"
      description="Lần giao đã xuất kho. Xác nhận POD (người nhận, ghi chú, minh chứng) để hoàn tất; POD ghi ngược mốc giao của lô hàng."
      columns={columns}
      rows={wh.deliveries}
      getRowId={(d) => d.deliveryId}
      searchLabel="Tìm lần giao hàng"
      searchPlaceholder="Tìm mã lần giao, đơn hàng, người nhận, khách…"
      searchText={(d) => [d.deliveryId, d.orderId, d.recipientName, d.carrier, customerOf.get(d.orderId)]}
      filters={[{ id: "status", label: "Mọi trạng thái", options: (Object.keys(deliveryStatusMeta) as DeliveryStatus[]).map((s) => ({ value: s, label: deliveryStatusMeta[s].label })), match: (d, v) => d.status === v }]}
      toggles={[{ id: "open", label: "Chỉ chưa có POD", match: (d) => d.status !== "da-giao", initial: false }]}
      sort={(a, b) => (a.status === "da-giao" ? 1 : 0) - (b.status === "da-giao" ? 1 : 0) || b.deliveryId.localeCompare(a.deliveryId)}
    />
  );
}
