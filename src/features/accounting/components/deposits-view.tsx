"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { canPerform } from "@/config/permissions";
import type { Column } from "@/components/shared/data-table";
import { ListView } from "@/components/shared/list-view";
import { depositMeta } from "@/config/crm";
import { DepositBadge } from "@/features/crm/components/meta-badges";
import { formatDate, formatMoney } from "@/lib/format";
import { matchStatement } from "@/services/accounting/rules";
import type { Contract, DepositStatus } from "@/types/crm";
import { useAccounting } from "../hooks";

export function DepositsView() {
  const { crm, acc, staffName, user } = useAccounting();
  const customerOf = new Map(crm.customers.map((c) => [c.customerId, c.name]));
  const rows = crm.contracts.filter((c) => c.status === "da-ky" && c.deposit.status !== "chua-yeu-cau");

  const columns: Column<Contract>[] = [
    { key: "order", header: "Đơn hàng", cell: (c) => <Link href={`/ke-toan/doi-soat/${c.orderId}`} className="font-mono text-xs font-medium text-primary hover:underline">{c.orderId}</Link> },
    { key: "cust", header: "Khách hàng", cell: (c) => <span className="block max-w-52 truncate font-medium">{customerOf.get(c.customerId)}</span> },
    { key: "amt", header: "Số tiền cọc", align: "right", cell: (c) => formatMoney(c.deposit.amount, c.currency) },
    { key: "req", header: "Yêu cầu", cell: (c) => <span className="text-xs text-muted-foreground">{c.deposit.requestedAt ? `${formatDate(c.deposit.requestedAt)} · ${staffName(c.deposit.requestedBy ?? "")}` : "—"}</span>, className: "hidden lg:table-cell" },
    { key: "bill", header: "Bill", cell: (c) => <span className="font-mono text-xs">{c.deposit.billRef ?? "—"}</span>, className: "hidden xl:table-cell" },
    {
      key: "match",
      header: "Sao kê (demo)",
      cell: (c) => {
        const m = matchStatement(c, acc.statementLines);
        if (!m.line) return <span className="text-xs text-warning">Chưa thấy dòng sao kê</span>;
        return m.exact ? <span className="text-xs text-success">Khớp số tiền</span> : <span className="text-xs text-danger">Lệch {formatMoney(m.diff ?? 0, "VND")}</span>;
      },
      className: "hidden md:table-cell",
    },
    { key: "status", header: "Trạng thái", cell: (c) => <DepositBadge value={c.deposit.status} /> },
    { key: "act", header: "Thao tác", cell: (c) => <Link href={`/ke-toan/doi-soat/${c.orderId}`} className={buttonVariants({ size: "sm", variant: c.deposit.status === "cho-ke-toan" && canPerform(user.role, "deposit.confirm") ? "default" : "outline" })}>{c.deposit.status === "cho-ke-toan" && canPerform(user.role, "deposit.confirm") ? "Đối soát" : "Xem"}</Link> },
  ];

  return (
    <ListView dateLabel="Ngày yêu cầu cọc" dateValue={(r) => r.deposit.requestedAt}
      title="Cọc cần đối soát"
      description="Yêu cầu xác nhận cọc từ Sale. Chỉ Kế toán xác nhận Đã cọc; chưa xác nhận thì Vận hành không đặt xưởng."
      columns={columns}
      rows={rows}
      getRowId={(c) => c.orderId}
      searchLabel="Tìm cọc"
      searchPlaceholder="Tìm order_id, khách, mã bill…"
      searchText={(c) => [c.orderId, c.contractNo, customerOf.get(c.customerId), c.deposit.billRef]}
      filters={[{ id: "status", label: "Mọi trạng thái cọc", initial: "cho-ke-toan", options: (Object.keys(depositMeta) as DepositStatus[]).filter((s) => s !== "chua-yeu-cau").map((s) => ({ value: s, label: depositMeta[s].label })), match: (c, v) => c.deposit.status === v, className: "w-56" }]}
      sort={(a, b) => (a.deposit.requestedAt ?? "").localeCompare(b.deposit.requestedAt ?? "") * -1}
    />
  );
}
