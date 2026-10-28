"use client";

import Link from "next/link";
import type { Column } from "@/components/shared/data-table";
import { ListView } from "@/components/shared/list-view";
import { settlementStatusMeta } from "@/config/accounting";
import { formatMoney } from "@/lib/format";
import { buildSettlement } from "@/services/accounting/rules";
import type { Contract } from "@/types/crm";
import type { SettlementStatus } from "@/types/accounting";
import { useAccounting } from "../hooks";
import { SettlementBadge } from "./accounting-badges";

export function SettlementsView() {
  const { crm, ops, acc } = useAccounting();
  const customerOf = new Map(crm.customers.map((c) => [c.customerId, c.name]));
  const status = (c: Contract): SettlementStatus => acc.settlements.find((s) => s.orderId === c.orderId)?.status ?? "chua-quyet-toan";
  // Chỉ đơn đã giao xong hoặc đã có hồ sơ quyết toán
  const rows = crm.contracts.filter((c) => c.status === "da-ky" && (acc.settlements.some((s) => s.orderId === c.orderId) || buildSettlement(c.orderId, crm, ops, acc)?.conditions[0].ok));

  const columns: Column<Contract>[] = [
    { key: "o", header: "Đơn hàng", cell: (c) => <Link href={`/ke-toan/quyet-toan/${c.orderId}`} className="font-mono text-xs font-medium text-primary hover:underline">{c.orderId}</Link> },
    { key: "c", header: "Khách hàng", cell: (c) => <span className="block max-w-52 truncate font-medium">{customerOf.get(c.customerId)}</span> },
    { key: "v", header: "Doanh thu", align: "right", cell: (c) => formatMoney(c.value, c.currency) },
    { key: "r", header: "Còn phải thu", align: "right", cell: (c) => formatMoney(buildSettlement(c.orderId, crm, ops, acc)?.receivable ?? 0, "VND"), className: "hidden md:table-cell" },
    { key: "m", header: "Lợi nhuận gộp", align: "right", cell: (c) => formatMoney(buildSettlement(c.orderId, crm, ops, acc)?.margin ?? 0, "VND"), className: "hidden lg:table-cell" },
    { key: "ok", header: "Điều kiện", cell: (c) => { const v = buildSettlement(c.orderId, crm, ops, acc); const n = v?.conditions.filter((x) => x.ok).length ?? 0; return <span className="text-xs text-muted-foreground">{n}/{v?.conditions.length ?? 4} đạt</span>; }, className: "hidden xl:table-cell" },
    { key: "s", header: "Trạng thái", cell: (c) => <SettlementBadge value={status(c)} /> },
  ];

  return (
    <ListView
      title="Quyết toán hợp đồng"
      description="Đơn đã giao xong. Chốt quyết toán khi đã thu đủ, chi xong và chứng từ đủ. Chủ quyết toán chưa được phân trong tài liệu (cần Ban GĐ chốt)."
      columns={columns}
      rows={rows}
      getRowId={(c) => c.orderId}
      searchLabel="Tìm hợp đồng quyết toán"
      searchPlaceholder="Tìm order_id, số hợp đồng, khách…"
      searchText={(c) => [c.orderId, c.contractNo, customerOf.get(c.customerId)]}
      filters={[{ id: "status", label: "Mọi trạng thái", options: (Object.keys(settlementStatusMeta) as SettlementStatus[]).map((s) => ({ value: s, label: settlementStatusMeta[s].label })), match: (c, v) => status(c) === v }]}
      sort={(a, b) => b.orderId.localeCompare(a.orderId)}
    />
  );
}
